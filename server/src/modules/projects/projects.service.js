'use strict';

const prisma = require('../../config/prisma');
const repo = require('./projects.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notifyMany } = require('../../core/services/notify');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

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
  return [...ids];
}

// Replaces raw {userId} assignee rows with resolved user objects for output.
async function decorate(project) {
  const ids = collectUserIds(project);
  const users = ids.length ? await repo.activeUsersByIds(ids) : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  const mapAssignees = (list) => (list || []).map((a) => byId.get(a.userId)).filter(Boolean);

  return {
    ...project,
    assignees: mapAssignees(project.assignees),
    phases: (project.phases || []).map((phase) => ({
      ...phase,
      assignees: mapAssignees(phase.assignees),
      tasks: (phase.tasks || []).map((task) => ({
        ...task,
        assignees: mapAssignees(task.assignees),
      })),
    })),
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
    if (query.search) {
      where.OR = [
        { referenceNumber: { contains: query.search } },
        { name: { contains: query.search } },
        { clientName: { contains: query.search } },
      ];
    }
    const { rows, total } = await repo.list({ where, skip, take });
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

  async get(id) {
    const project = await repo.findById(id);
    if (!project) throw AppError.notFound('Project not found');
    return decorate(project);
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
    const [statusRows, categoryRows, total, amountAgg] = await Promise.all([
      repo.statusCounts(),
      repo.categoryCounts(),
      repo.countActive(),
      repo.sumAmount(),
    ]);
    const byStatus = statusRows.map((r) => ({ label: r.status, value: r._count._all }));
    const byCategory = categoryRows.map((r) => ({ label: r.category || 'Uncategorized', value: r._count._all }));
    return {
      totalProjects: total,
      totalValue: (amountAgg._sum.projectAmount || 0).toString(),
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
      projectAmount: payload.projectAmount ?? 0,
      advanceAmount: payload.advanceAmount ?? 0,
      customFields: payload.customFields ?? undefined,
      createdById: actor.id,
      phases: {
        create: phases.map((phase, i) => ({
          name: phase.name,
          status: phase.status || 'pending',
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
    return decorate(project);
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findRawById(id);
    if (!existing) throw AppError.notFound('Project not found');
    if (payload.customFields) await validateCustomFields(payload.customFields);

    const data = { ...payload };
    if (data.clientEmail === '') data.clientEmail = null;

    const project = await repo.update(id, data);
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
    return decorate(project);
  },

  async remove(id, actor, req) {
    const existing = await repo.findRawById(id);
    if (!existing) throw AppError.notFound('Project not found');
    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'project.deleted', entityType: 'project', entityId: id, req });
    return { success: true };
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
    return this.get(projectId);
  },

  async updatePhase(projectId, phaseId, payload, actor, req) {
    await this.assertPhase(projectId, phaseId);
    const { assigneeIds, ...fields } = payload;
    if (Object.keys(fields).length) await repo.updatePhase(phaseId, fields);
    if (assigneeIds !== undefined) {
      await repo.setPhaseAssignees(phaseId, await validateAssignees(assigneeIds));
    }
    activity.record({ userId: actor.id, action: 'phase.updated', entityType: 'project', entityId: projectId, req });
    return this.get(projectId);
  },

  async removePhase(projectId, phaseId, actor, req) {
    await this.assertPhase(projectId, phaseId);
    await repo.deletePhase(phaseId);
    activity.record({ userId: actor.id, action: 'phase.deleted', entityType: 'project', entityId: projectId, req });
    return this.get(projectId);
  },

  // --- tasks ---
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
    activity.record({ userId: actor.id, action: 'task.created', entityType: 'project', entityId: projectId, req });
    return this.get(projectId);
  },

  async updateTask(projectId, phaseId, taskId, payload, actor, req) {
    await this.assertPhase(projectId, phaseId);
    await this.assertTask(phaseId, taskId);
    const { assigneeIds, ...fields } = payload;
    if (Object.keys(fields).length) await repo.updateTask(taskId, fields);
    if (assigneeIds !== undefined) {
      await repo.setTaskAssignees(taskId, await validateAssignees(assigneeIds));
    }
    activity.record({ userId: actor.id, action: 'task.updated', entityType: 'project', entityId: projectId, req });
    return this.get(projectId);
  },

  async removeTask(projectId, phaseId, taskId, actor, req) {
    await this.assertPhase(projectId, phaseId);
    await this.assertTask(phaseId, taskId);
    await repo.deleteTask(taskId);
    activity.record({ userId: actor.id, action: 'task.deleted', entityType: 'project', entityId: projectId, req });
    return this.get(projectId);
  },
};

module.exports = projectsService;
