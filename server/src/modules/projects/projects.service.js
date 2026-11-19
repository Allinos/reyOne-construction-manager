'use strict';

const prisma = require('../../config/prisma');
const repo = require('./projects.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notify, notifyMany } = require('../../core/services/notify');
const { getPagination, buildMeta } = require('../../core/utils/pagination');
const { accessibleProjectIds, assertProjectAccess, hasPerm, seesAllProjects } = require('../../core/services/access');

// --- helpers -------------------------------------------------------------

async function getSetting(group, key, fallback) {
  const row = await prisma.setting.findUnique({ where: { group_key: { group, key } } });
  return row ? row.value : fallback;
}

// Generates the next reference number using the configured prefix. The unique
// constraint is the real guard; on the rare collision we retry with a bump.
async function generateReference() {
  const prefix = await getSetting('projects', 'reference_prefix', 'PRJ-');
  let n = (await repo.countAll()) + 1;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `${prefix}${String(n).padStart(4, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    const existing = await repo.findByReference(candidate);
    if (!existing) return candidate;
    n += 1;
  }
  return `${prefix}${Date.now()}`;
}

// Phases come from the request, or are snapshotted from the settings template.
async function resolvePhases(inputPhases) {
  if (inputPhases && inputPhases.length) return inputPhases;
  const template = await getSetting('projects', 'phase_templates', []);
  return (Array.isArray(template) ? template : []).map((name, i) => ({ name, sortOrder: i }));
}

// Enforces that required, visible custom fields have a value.
async function validateCustomFields(customFields = {}) {
  const defs = await prisma.fieldDefinition.findMany({
    where: { entityType: 'project', isCustom: true, required: true, visible: true },
  });
  const missing = defs
    .filter((d) => {
      const v = customFields[d.key];
      return v === undefined || v === null || v === '';
    })
    .map((d) => d.label);
  if (missing.length) throw AppError.badRequest(`Missing required field(s): ${missing.join(', ')}`);
}

// Rejects assignee ids that don't map to an active user.
async function validateAssignees(ids) {
  const unique = [...new Set(ids || [])];
  if (!unique.length) return unique;
  const count = await repo.countActiveUsersByIds(unique);
  if (count !== unique.length) throw AppError.badRequest('One or more assigned users do not exist');
  return unique;
}

function collectUserIds(project) {
  const ids = new Set();
  for (const a of project.assignees || []) ids.add(a.userId);
  for (const phase of project.phases || []) {
    for (const a of phase.assignees || []) ids.add(a.userId);
    for (const task of phase.tasks || []) {
      for (const a of task.assignees || []) ids.add(a.userId);
    }
  }
  for (const ap of project.approvals || []) {
    if (ap.requestedById) ids.add(ap.requestedById);
    if (ap.decidedById) ids.add(ap.decidedById);
  }
  return [...ids];
}

// --- progress ---------------------------------------------------------------
// A phase is 100% when marked completed, otherwise its completed-task ratio.
// A phase with no tasks contributes 0 until it is marked completed.
function phaseProgress(phase) {
  if (phase.status === 'completed') return 100;
  const tasks = phase.tasks || [];
  if (!tasks.length) return 0;
  const done = tasks.filter((t) => t.status === 'completed').length;
  return Math.round((done / tasks.length) * 100);
}

// Project progress = equal-weighted average of its phases (100 when the project
// itself is completed, 0 when it has no phases).
function computeProgress(project) {
  if (project.status === 'completed') return 100;
  const phases = project.phases || [];
  if (!phases.length) return 0;
  const sum = phases.reduce((s, ph) => s + phaseProgress(ph), 0);
  return Math.round(sum / phases.length);
}

// Replaces raw {userId} assignee rows with resolved user objects for output.
async function decorate(project) {
  const ids = collectUserIds(project);
  const users = ids.length ? await repo.activeUsersByIds(ids) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const mapAssignees = (list) => (list || []).map((a) => byId.get(a.userId)).filter(Boolean);

  const phases = (project.phases || []).map((phase) => ({
    ...phase,
    progress: phaseProgress(phase),
    assignees: mapAssignees(phase.assignees),
    tasks: (phase.tasks || []).map((task) => ({
      ...task,
      assignees: mapAssignees(task.assignees),
    })),
  }));

  // Auto-mode projects report live progress; manual-mode uses the stored value.
  const progress = project.progressMode === 'manual' ? project.progress : computeProgress(project);

  const approvals = (project.approvals || []).map((ap) => ({
    ...ap,
    requestedBy: byId.get(ap.requestedById) || null,
    decidedBy: ap.decidedById ? byId.get(ap.decidedById) || null : null,
  }));

  return {
    ...project,
    progress,
    assignees: mapAssignees(project.assignees),
    phases,
    approvals,
  };
}

// --- access levels -------------------------------------------------------
// full  – sees everything (managers with projects.view_all, project members, creator)
// phase – assigned to one or more stages: full detail of those stages only
// task  – assigned to tasks only: full detail of those tasks only
// Everything else on the project is shown as basic information (names, status,
// progress) without who is assigned, money or other people's requests.
function accessLevel(actor, raw) {
  const phaseIds = [];
  const taskIds = [];
  for (const ph of raw.phases || []) {
    if ((ph.assignees || []).some((a) => a.userId === actor?.id)) phaseIds.push(ph.id);
    for (const t of ph.tasks || []) if ((t.assignees || []).some((a) => a.userId === actor?.id)) taskIds.push(t.id);
  }
  let level = 'full';
  if (actor && !seesAllProjects(actor) && raw.createdById !== actor.id && !(raw.assignees || []).some((a) => a.userId === actor.id)) {
    level = phaseIds.length ? 'phase' : 'task';
  }
  return { level, phaseIds, taskIds };
}

function redact(project, access) {
  const mineTask = (t) => access.taskIds.includes(t.id);
  const phases = project.phases.map((ph) => {
    const minePhase = access.phaseIds.includes(ph.id);
    const tasks = ph.tasks.map((t) => {
      const full = access.level === 'full' || minePhase || mineTask(t);
      return full ? { ...t, mine: mineTask(t) } : { id: t.id, title: t.title, status: t.status, deadline: t.deadline, sortOrder: t.sortOrder, assignees: [], description: null, limited: true };
    });
    if (access.level === 'full' || minePhase) return { ...ph, mine: minePhase, tasks };
    return { ...ph, assignees: [], tasks, limited: true, mine: false };
  });
  if (access.level === 'full') return { ...project, phases, access };
  return {
    ...project,
    projectAmount: null,
    advanceAmount: null,
    assignees: [],
    approvals: [],
    phases,
    access,
  };
}

// --- service -------------------------------------------------------------

const projectsService = {
  async list(query, actor) {
    const { page, limit, skip, take } = getPagination(query);
    const where = { deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    // "mine" restricts to projects the current user is assigned to (employee panel).
    if ((query.mine === 'true' || query.mine === true) && actor) {
      where.assignees = { some: { userId: actor.id } };
    }
    // Project-based access: without projects.view_all, only assigned projects.
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null) where.id = { in: allowed };
    if (query.search) {
      where.OR = [
        { referenceNumber: { contains: query.search } },
        { name: { contains: query.search } },
        { clientName: { contains: query.search } },
      ];
    }
    const { rows, total } = await repo.list({ where, skip, take });
    // Stage/task-level members don't see contract values in the list either.
    if (allowed !== null && rows.length) {
      const [members, created] = await Promise.all([
        prisma.projectAssignee.findMany({ where: { userId: actor.id, projectId: { in: rows.map((r) => r.id) } }, select: { projectId: true } }),
        prisma.project.findMany({ where: { id: { in: rows.map((r) => r.id) }, createdById: actor.id }, select: { id: true } }),
      ]);
      const fullIds = new Set([...members.map((m) => m.projectId), ...created.map((c) => c.id)]);
      for (const r of rows) {
        if (!fullIds.has(r.id)) {
          if ('projectAmount' in r) r.projectAmount = null;
          if ('advanceAmount' in r) r.advanceAmount = null;
        }
      }
    }
    // Card details: current stage, team, photo / open query counts, and spend for finance users.
    if (rows.length) {
      const ids = rows.map((r) => r.id);
      const seesMoney = !actor || hasPerm(actor, 'finance.read');
      const [names, photos, queries, spent] = await Promise.all([
        repo.activeUsersByIds([...new Set(rows.flatMap((r) => r.assignees.map((a) => a.userId)))]),
        prisma.projectPhoto.groupBy({ by: ['projectId'], where: { projectId: { in: ids } }, _count: { _all: true } }).catch(() => []),
        prisma.query.groupBy({ by: ['projectId'], where: { projectId: { in: ids }, deletedAt: null, status: { notIn: ['resolved', 'closed'] } }, _count: { _all: true } }).catch(() => []),
        seesMoney ? prisma.expense.groupBy({ by: ['projectId'], where: { projectId: { in: ids } }, _sum: { amount: true } }).catch(() => []) : [],
      ]);
      const nameOf = new Map(names.map((u) => [u.id, u.name]));
      const count = (list) => new Map(list.map((x) => [x.projectId, x._count._all]));
      const photoN = count(photos);
      const queryN = count(queries);
      const spentBy = new Map(spent.map((x) => [x.projectId, Number(x._sum.amount || 0)]));
      for (const r of rows) {
        r.stage = (r.phases.find((ph) => ph.status !== 'completed') || {}).name || null;
        r.stageCount = r.phases.length;
        r.team = r.assignees.map((a) => nameOf.get(a.userId)).filter(Boolean).slice(0, 4);
        r.teamCount = r.assignees.length;
        r.photoCount = photoN.get(r.id) || 0;
        r.openQueries = queryN.get(r.id) || 0;
        if (seesMoney && r.projectAmount !== null) r.spent = spentBy.get(r.id) || 0;
        delete r.phases;
        delete r.assignees;
      }
    }
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async assignEmployees(projectId, userIds, actor, req) {
    const project = await this.assertProject(projectId);
    const ids = await validateAssignees(userIds);
    const existing = await repo.projectAssigneeUserIds(projectId);
    await repo.setProjectAssignees(projectId, ids);

    const added = ids.filter((id) => !existing.includes(id));
    if (added.length) {
      notifyMany(added, {
        type: 'project.assigned',
        title: 'New project assigned',
        message: `You have been assigned to ${project.name} (${project.referenceNumber}).`,
        entityType: 'project',
        entityId: projectId,
      });
    }
    activity.record({ userId: actor.id, action: 'project.assignees_updated', entityType: 'project', entityId: projectId, req });
    return this.get(projectId);
  },

  async get(id, actor) {
    if (actor) await assertProjectAccess(actor, id);
    const project = await repo.findById(id);
    if (!project) throw AppError.notFound('Project not found');
    const access = accessLevel(actor, project);
    const out = redact(await decorate(project), access);
    // The client's directory record (contact person, GST) for people who can see clients.
    if (access.level === 'full' && (!actor || hasPerm(actor, 'clients.read'))) {
      out.client = await prisma.client.findFirst({ where: { name: project.clientName, deletedAt: null }, select: { id: true, contactPerson: true, phone: true, email: true, address: true, gstNumber: true } }).catch(() => null);
    }
    return out;
  },

  listClients() {
    return repo.distinctClients().then((rows) =>
      rows.map((r) => ({
        name: r.clientName,
        phone: r.clientPhone,
        email: r.clientEmail,
        address: r.clientAddress,
      })),
    );
  },

  async lastReference() {
    const [latest, prefix] = await Promise.all([
      repo.latestReference(),
      getSetting('projects', 'reference_prefix', 'PRJ-'),
    ]);
    return { last: latest?.referenceNumber || null, prefix };
  },

  async analytics() {
    const [statusRows, categoryRows, total, amountAgg, avgAgg, progressRows, overdue, upcoming, pendingApprovals] =
      await Promise.all([
        repo.statusCounts(),
        repo.categoryCounts(),
        repo.countActive(),
        repo.sumAmount(),
        repo.avgProgress(),
        repo.progressValues(),
        repo.overdueCount(),
        repo.upcomingDeadlines(30),
        repo.pendingApprovalCount(),
      ]);
    const byStatus = statusRows.map((r) => ({ label: r.status, value: r._count._all }));
    const byCategory = categoryRows.map((r) => ({ label: r.category || 'Uncategorized', value: r._count._all }));

    // Completion distribution across all active projects.
    const buckets = [
      { label: 'Not started', min: 0, max: 0 },
      { label: '1–25%', min: 1, max: 25 },
      { label: '26–50%', min: 26, max: 50 },
      { label: '51–75%', min: 51, max: 75 },
      { label: '76–99%', min: 76, max: 99 },
      { label: 'Completed', min: 100, max: 100 },
    ];
    const progressBuckets = buckets.map((b) => ({
      label: b.label,
      value: progressRows.filter((p) => p.progress >= b.min && p.progress <= b.max).length,
    }));
    const completed = progressRows.filter((p) => p.progress >= 100 || p.status === 'completed').length;

    return {
      totalProjects: total,
      totalValue: (amountAgg._sum.projectAmount || 0).toString(),
      avgProgress: Math.round(avgAgg._avg.progress || 0),
      completed,
      inProgress: total - completed,
      overdue,
      pendingApprovals,
      upcoming: upcoming.map((u) => ({
        id: u.id,
        referenceNumber: u.referenceNumber,
        name: u.name,
        endDate: u.endDate,
        progress: u.progress,
        status: u.status,
      })),
      progressBuckets,
      byStatus,
      byCategory,
    };
  },

  async create(payload, actor, req) {
    await validateCustomFields(payload.customFields);

    const referenceNumber = payload.referenceNumber || (await generateReference());
    if (payload.referenceNumber && (await repo.findByReference(referenceNumber))) {
      throw AppError.conflict('A project with this reference number already exists');
    }

    const phases = await resolvePhases(payload.phases);
    // Validate all assignees up front (phase-level and task-level).
    for (const phase of phases) {
      await validateAssignees(phase.assigneeIds);
      for (const task of phase.tasks || []) await validateAssignees(task.assigneeIds);
    }

    const data = {
      referenceNumber,
      name: payload.name,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      clientEmail: payload.clientEmail || null,
      clientAddress: payload.clientAddress,
      category: payload.category,
      status: payload.status || 'pending',
      agreementDate: payload.agreementDate,
      startDate: payload.startDate ?? null,
      endDate: payload.endDate ?? null,
      projectAmount: payload.projectAmount ?? 0,
      advanceAmount: payload.advanceAmount ?? 0,
      progressMode: payload.progressMode === 'manual' ? 'manual' : 'auto',
      progress: payload.progressMode === 'manual' ? payload.progress ?? 0 : 0,
      customFields: payload.customFields ?? undefined,
      createdById: actor.id,
      phases: {
        create: phases.map((phase, i) => ({
          name: phase.name,
          status: phase.status || 'pending',
          startDate: phase.startDate ?? null,
          deadline: phase.deadline,
          sortOrder: phase.sortOrder ?? i,
          assignees: { create: [...new Set(phase.assigneeIds || [])].map((userId) => ({ userId })) },
          tasks: {
            create: (phase.tasks || []).map((task, j) => ({
              title: task.title,
              description: task.description,
              status: task.status || 'pending',
              deadline: task.deadline,
              sortOrder: task.sortOrder ?? j,
              assignees: { create: [...new Set(task.assigneeIds || [])].map((userId) => ({ userId })) },
            })),
          },
        })),
      },
    };

    const project = await repo.create(data);
    activity.record({ userId: actor.id, action: 'project.created', entityType: 'project', entityId: project.id, req });
    await this.syncProgress(project.id);

    // Keep the Clients directory in sync (create if new; never clobber enriched fields).
    try {
      await prisma.client.upsert({
        where: { name: payload.clientName },
        update: {},
        create: {
          name: payload.clientName,
          phone: payload.clientPhone || null,
          email: payload.clientEmail || null,
          address: payload.clientAddress || null,
        },
      });
    } catch {
      /* best-effort */
    }

    // An advance amount is money already received — record it as a payment so it
    // flows into finance totals automatically (never fails project creation).
    if (Number(payload.advanceAmount) > 0) {
      try {
        const [methods, accounts] = await Promise.all([
          getSetting('finance', 'payment_methods', []),
          getSetting('finance', 'accounts', []),
        ]);
        const method = (Array.isArray(methods) && methods[0]) || 'Cash';
        const accList = Array.isArray(accounts) ? accounts : [];
        const account = (accList[0] && (accList[0].key || accList[0])) || 'cash';
        await prisma.payment.create({
          data: {
            projectId: project.id,
            // Use the persisted Decimal so the payment exactly equals the advance.
            amount: project.advanceAmount,
            date: payload.agreementDate || new Date(),
            method,
            account,
            notes: 'Advance Payment',
            createdById: actor.id,
          },
        });
      } catch {
        /* advance payment is best-effort */
      }
    }
    return decorate(project);
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findRawById(id);
    if (!existing) throw AppError.notFound('Project not found');
    if (payload.customFields) await validateCustomFields(payload.customFields);

    const data = { ...payload };
    if (data.clientEmail === '') data.clientEmail = null;

    await repo.update(id, data);
    activity.record({ userId: actor.id, action: 'project.updated', entityType: 'project', entityId: id, req });

    // Notify assigned employees when the project status changes.
    if (payload.status && payload.status !== existing.status) {
      const assignees = await repo.projectAssigneeUserIds(id);
      notifyMany(assignees, {
        type: 'project.status',
        title: 'Project status updated',
        message: `${existing.name} status changed to "${payload.status}".`,
        entityType: 'project',
        entityId: id,
      });
    }
    // A status change (or a switch back to auto) can move the completion %.
    await this.syncProgress(id);
    return this.get(id);
  },

  async remove(id, actor, req) {
    const existing = await repo.findRawById(id);
    if (!existing) throw AppError.notFound('Project not found');
    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'project.deleted', entityType: 'project', entityId: id, req });
    return { success: true };
  },

  // Recompute and persist the stored completion % (auto mode only). Called
  // after any change that can move it, so the list view stays correct without
  // loading every phase/task.
  async syncProgress(projectId) {
    const inputs = await repo.progressInputs(projectId);
    if (!inputs || inputs.progressMode === 'manual') return;
    await repo.setProgress(projectId, computeProgress(inputs));
  },

  // --- approvals / requests ---
  // Who hears about a new request: the project's assignees and its creator
  // (minus the requester). In practice this reaches the project manager, who
  // holds `projects.approve`.
  async approverRecipients(projectId, excludeUserId) {
    const [assignees, project] = await Promise.all([
      repo.projectAssigneeUserIds(projectId),
      repo.findRawById(projectId),
    ]);
    const ids = new Set(assignees);
    if (project?.createdById) ids.add(project.createdById);
    ids.delete(excludeUserId);
    return [...ids];
  },

  async listApprovals(projectId, actor) {
    await this.assertProject(projectId);
    if (actor) await assertProjectAccess(actor, projectId);
    let rows = await repo.listApprovals({ projectId });
    // Stage/task-level members only see the requests they raised themselves.
    if (actor && !seesAllProjects(actor)) {
      const raw = await repo.findById(projectId);
      if (accessLevel(actor, raw).level !== 'full') rows = rows.filter((r) => r.requestedById === actor.id);
    }
    const ids = [...new Set(rows.flatMap((r) => [r.requestedById, r.decidedById]).filter(Boolean))];
    const users = ids.length ? await repo.activeUsersByIds(ids) : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return rows.map((r) => ({
      ...r,
      requestedBy: byId.get(r.requestedById) || null,
      decidedBy: r.decidedById ? byId.get(r.decidedById) || null : null,
    }));
  },

  async createApproval(projectId, payload, actor, req) {
    await this.assertProject(projectId);
    if (payload.phaseId) await this.assertPhase(projectId, payload.phaseId);
    const approval = await repo.createApproval({
      projectId,
      phaseId: payload.phaseId ?? null,
      type: payload.type || 'general',
      title: payload.title,
      description: payload.description ?? null,
      amount: payload.amount ?? null,
      priority: payload.priority || 'normal',
      requestedById: actor.id,
    });
    activity.record({ userId: actor.id, action: 'project.approval_requested', entityType: 'project', entityId: projectId, req });

    const project = await repo.findRawById(projectId);
    const recipients = await this.approverRecipients(projectId, actor.id);
    notifyMany(recipients, {
      type: 'project.approval_requested',
      title: 'Approval requested',
      message: `${actor.name || 'A user'} requested approval: "${payload.title}" on ${project?.name || 'a project'}.`,
      entityType: 'project',
      entityId: projectId,
    });
    return approval;
  },

  async decideApproval(projectId, approvalId, payload, actor, req) {
    await this.assertProject(projectId);
    const approval = await repo.findApproval(approvalId);
    if (!approval || approval.projectId !== projectId) throw AppError.notFound('Approval request not found');
    if (approval.status !== 'pending') throw AppError.badRequest('This request has already been decided');

    const status = payload.decision === 'approve' ? 'approved' : 'rejected';
    const updated = await repo.updateApproval(approvalId, {
      status,
      decidedById: actor.id,
      decidedAt: new Date(),
      decisionNote: payload.note ?? null,
    });
    activity.record({ userId: actor.id, action: `project.approval_${status}`, entityType: 'project', entityId: projectId, req });

    const project = await repo.findRawById(projectId);
    notify({
      userId: approval.requestedById,
      type: 'project.approval_decided',
      title: `Request ${status}`,
      message: `Your request "${approval.title}" on ${project?.name || 'a project'} was ${status}.`,
      entityType: 'project',
      entityId: projectId,
    });
    return updated;
  },

  // --- phases ---
  async assertProject(id) {
    const project = await repo.findRawById(id);
    if (!project) throw AppError.notFound('Project not found');
    return project;
  },

  async assertPhase(projectId, phaseId) {
    const phase = await repo.findPhase(phaseId);
    if (!phase || phase.projectId !== projectId) throw AppError.notFound('Phase not found');
    return phase;
  },

  async addPhase(projectId, payload, actor, req) {
    await this.assertProject(projectId);
    const assigneeIds = await validateAssignees(payload.assigneeIds);
    for (const task of payload.tasks || []) await validateAssignees(task.assigneeIds);

    const phase = await repo.createPhase({
      projectId,
      name: payload.name,
      status: payload.status || 'pending',
      startDate: payload.startDate ?? null,
      deadline: payload.deadline,
      sortOrder: payload.sortOrder ?? 0,
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      tasks: {
        create: (payload.tasks || []).map((task, j) => ({
          title: task.title,
          description: task.description,
          status: task.status || 'pending',
          deadline: task.deadline,
          sortOrder: task.sortOrder ?? j,
          assignees: { create: [...new Set(task.assigneeIds || [])].map((userId) => ({ userId })) },
        })),
      },
    });
    activity.record({ userId: actor.id, action: 'phase.created', entityType: 'project', entityId: projectId, req });
    await this.syncProgress(projectId);
    return this.get(projectId);
  },

  async updatePhase(projectId, phaseId, payload, actor, req) {
    await this.assertPhase(projectId, phaseId);
    const { assigneeIds, ...fields } = payload;
    if (Object.keys(fields).length) await repo.updatePhase(phaseId, fields);
    if (assigneeIds !== undefined) {
      const ids = await validateAssignees(assigneeIds);
      const prev = (await prisma.phaseAssignee.findMany({ where: { phaseId }, select: { userId: true } })).map((a) => a.userId);
      await repo.setPhaseAssignees(phaseId, ids);
      const added = ids.filter((u) => !prev.includes(u) && u !== actor.id);
      if (added.length) {
        const phase = await prisma.projectPhase.findUnique({ where: { id: phaseId }, select: { name: true, project: { select: { name: true } } } });
        notifyMany(added, { type: 'project.phase_assigned', title: 'Stage assigned to you', message: `${phase?.name || 'Stage'} — ${phase?.project?.name || 'project'}`, entityType: 'project', entityId: projectId });
      }
    }
    activity.record({ userId: actor.id, action: 'phase.updated', entityType: 'project', entityId: projectId, req });
    await this.syncProgress(projectId);
    return this.get(projectId);
  },

  async removePhase(projectId, phaseId, actor, req) {
    await this.assertPhase(projectId, phaseId);
    await repo.deletePhase(phaseId);
    activity.record({ userId: actor.id, action: 'phase.deleted', entityType: 'project', entityId: projectId, req });
    await this.syncProgress(projectId);
    return this.get(projectId);
  },

  // --- tasks ---
  async notifyTaskAssignees(projectId, title, userIds) {
    if (!userIds.length) return;
    const project = await repo.findRawById(projectId);
    notifyMany(userIds, {
      type: 'project.task_assigned',
      title: 'Task assigned to you',
      message: `${title} — ${project?.name || 'project'}`,
      entityType: 'project',
      entityId: projectId,
    });
  },

  async assertTask(phaseId, taskId) {
    const task = await repo.findTask(taskId);
    if (!task || task.phaseId !== phaseId) throw AppError.notFound('Task not found');
    return task;
  },

  async addTask(projectId, phaseId, payload, actor, req) {
    await this.assertPhase(projectId, phaseId);
    const assigneeIds = await validateAssignees(payload.assigneeIds);
    await repo.createTask({
      phaseId,
      title: payload.title,
      description: payload.description,
      status: payload.status || 'pending',
      deadline: payload.deadline,
      sortOrder: payload.sortOrder ?? 0,
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
    });
    this.notifyTaskAssignees(projectId, payload.title, assigneeIds.filter((u) => u !== actor.id)).catch(() => {});
    activity.record({ userId: actor.id, action: 'task.created', entityType: 'project', entityId: projectId, req });
    await this.syncProgress(projectId);
    return this.get(projectId);
  },

  async updateTask(projectId, phaseId, taskId, payload, actor, req) {
    await this.assertPhase(projectId, phaseId);
    const task = await this.assertTask(phaseId, taskId);
    const canEdit = hasPerm(actor, 'projects.update');
    if (!canEdit) {
      // People assigned to the task (or its stage) may only tick it done / reopen it.
      await assertProjectAccess(actor, projectId);
      const [onTask, onPhase] = await Promise.all([
        prisma.taskAssignee.findUnique({ where: { taskId_userId: { taskId, userId: actor.id } } }),
        prisma.phaseAssignee.findUnique({ where: { phaseId_userId: { phaseId, userId: actor.id } } }),
      ]);
      if (!onTask && !onPhase) throw AppError.forbidden('Only people assigned to this task can update it');
      const keys = Object.keys(payload);
      if (keys.some((k) => k !== 'status')) throw AppError.forbidden('You can only change the status of your task');
    }
    const { assigneeIds, ...fields } = payload;
    const before = task.assignees ? task.assignees.map((a) => a.userId) : null;
    if (Object.keys(fields).length) await repo.updateTask(taskId, fields);
    if (assigneeIds !== undefined) {
      const ids = await validateAssignees(assigneeIds);
      const prev = before || (await prisma.taskAssignee.findMany({ where: { taskId }, select: { userId: true } })).map((a) => a.userId);
      await repo.setTaskAssignees(taskId, ids);
      this.notifyTaskAssignees(projectId, task.title, ids.filter((u) => !prev.includes(u) && u !== actor.id)).catch(() => {});
    }
    activity.record({ userId: actor.id, action: 'task.updated', entityType: 'project', entityId: projectId, req });
    await this.syncProgress(projectId);
    return this.get(projectId, actor);
  },

  async removeTask(projectId, phaseId, taskId, actor, req) {
    await this.assertPhase(projectId, phaseId);
    await this.assertTask(phaseId, taskId);
    await repo.deleteTask(taskId);
    activity.record({ userId: actor.id, action: 'task.deleted', entityType: 'project', entityId: projectId, req });
    await this.syncProgress(projectId);
    return this.get(projectId);
  },
};

module.exports = projectsService;
