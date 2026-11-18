'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notify } = require('../../core/services/notify');
const { userNames, projectNames } = require('../../core/services/people');
const { accessibleProjectIds, assertProjectAccess, hasPerm } = require('../../core/services/access');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

// Item results: pass | fail | action (needs corrective action) | na | '' (pending)
function score(checklist = []) {
  const rated = checklist.filter((c) => ['pass', 'fail', 'action'].includes(c.result));
  const pass = rated.filter((c) => c.result === 'pass').length;
  return { total: checklist.length, pass, fail: rated.length - pass, pct: rated.length ? Math.round((pass / rated.length) * 100) : null };
}

// Legacy rows used "open" for anything not closed.
const normStatus = (st) => (st === 'open' ? 'in_progress' : st);
const answered = (checklist = []) => checklist.filter((c) => c.result).length;
const flagged = (checklist = []) => checklist.filter((c) => c.result === 'fail' || c.result === 'action').length;
const OPEN_STATES = ['pending', 'assigned', 'in_progress', 'open'];

async function canSee(actor, row) {
  if (row.inspectorId === actor.id) return;
  if (!hasPerm(actor, 'inspections.read')) throw AppError.forbidden('You do not have permission to do this');
  await assertProjectAccess(actor, row.projectId);
}

async function getInspection(id) {
  const row = await prisma.inspection.findFirst({ where: { id, deletedAt: null }, include: { issues: { orderBy: { id: 'asc' } } } });
  if (!row) throw AppError.notFound('Inspection not found');
  return row;
}

const inspectionsService = {
  async templates() {
    const row = await prisma.setting.findUnique({ where: { group_key: { group: 'inspections', key: 'checklists' } } });
    return Array.isArray(row?.value) ? row.value : [];
  },

  async list(query, actor) {
    const where = { deletedAt: null };
    if (query.status === 'active') where.status = { in: OPEN_STATES };
    else if (query.status === 'in_progress') where.status = { in: ['in_progress', 'open'] };
    else if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.mine === 'true') {
      where.inspectorId = actor.id;
    } else {
      if (!hasPerm(actor, 'inspections.read')) throw AppError.forbidden('You do not have permission to do this');
      const allowed = await accessibleProjectIds(actor);
      if (allowed !== null) {
        // Also include inspections assigned to me on projects I'm not on.
        const scope = query.projectId ? (allowed.includes(query.projectId) ? [query.projectId] : []) : allowed;
        where.OR = [{ projectId: { in: scope } }, { inspectorId: actor.id }];
      }
    }
    const rows = await prisma.inspection.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 300, include: { issues: { select: { status: true, severity: true } } } });
    const [projects, users] = await Promise.all([projectNames(rows.map((r) => r.projectId)), userNames(rows.map((r) => r.inspectorId))]);
    return rows.map(({ issues, checklist, ...r }) => ({
      ...r,
      status: normStatus(r.status),
      answered: answered(checklist),
      checklistCount: (checklist || []).length,
      overdue: !!(r.dueDate && OPEN_STATES.includes(r.status) && new Date(r.dueDate) < new Date(new Date().toDateString())),
      flagged: flagged(checklist),
      projectName: projects.get(r.projectId)?.name || null,
      inspectorName: users.get(r.inspectorId) || null,
      score: score(checklist),
      issueCount: issues.length,
      openIssues: issues.filter((i) => !['resolved', 'verified'].includes(i.status)).length,
    }));
  },

  async get(id, actor) {
    const row = await getInspection(id);
    await canSee(actor, row);
    const [projects, users, photos] = await Promise.all([
      projectNames([row.projectId]),
      userNames([row.inspectorId, row.createdById, row.completedById, ...row.issues.map((i) => i.assignedToId)]),
      prisma.storedFile.count({ where: { entityType: 'inspection', entityId: id } }),
    ]);
    return {
      ...row,
      status: normStatus(row.status),
      projectName: projects.get(row.projectId)?.name || null,
      inspectorName: users.get(row.inspectorId) || null,
      createdByName: users.get(row.createdById) || null,
      completedByName: users.get(row.completedById) || null,
      answered: answered(row.checklist),
      isInspector: row.inspectorId === actor.id,
      score: score(row.checklist),
      photoCount: photos,
      issues: row.issues.map((i) => ({ ...i, assignedToName: users.get(i.assignedToId) || null })),
    };
  },

  async create(payload, actor, req) {
    await assertProjectAccess(actor, payload.projectId);
    let checklist = payload.checklist;
    if (!checklist && payload.templateKey) {
      const tpl = (await this.templates()).find((t) => t.key === payload.templateKey);
      checklist = (tpl?.items || []).map((item) => ({ item, result: '', remark: '' }));
    }
    const inspectorId = payload.unassigned ? null : payload.inspectorId || actor.id;
    const row = await prisma.inspection.create({
      data: {
        projectId: payload.projectId,
        title: payload.title,
        date: payload.date || new Date(),
        dueDate: payload.dueDate || null,
        inspectorId,
        instructions: payload.instructions || null,
        status: !inspectorId ? 'pending' : inspectorId === actor.id ? 'in_progress' : 'assigned',
        checklist: checklist || [],
        remarks: payload.remarks || null,
        createdById: actor.id,
      },
    });
    activity.record({ userId: actor.id, action: 'inspection.created', entityType: 'inspection', entityId: row.id, req });
    if (inspectorId && inspectorId !== actor.id) {
      const project = (await projectNames([row.projectId])).get(row.projectId);
      const due = row.dueDate ? ` · due ${fmt(row.dueDate)}` : '';
      notify({ userId: inspectorId, type: 'inspection.assigned', title: 'Inspection assigned to you', message: `${row.title} — ${project?.name || 'site'}${due}`, entityType: 'inspection', entityId: row.id });
    }
    return row;
  },

  async update(id, payload, actor, req) {
    const row = await getInspection(id);
    const isManager = hasPerm(actor, 'inspections.manage');
    const isInspector = row.inspectorId === actor.id;
    if (!isManager && !isInspector) throw AppError.forbidden('Only the assigned inspector or a manager can update this inspection');
    if (isManager) await canSee(actor, row);
    const data = { ...payload };
    if (!isManager) {
      // The inspector fills the checklist, notes and submits — nothing else.
      for (const k of Object.keys(data)) if (!['checklist', 'remarks', 'status'].includes(k)) delete data[k];
      if (data.status && !['in_progress', 'completed'].includes(data.status)) throw AppError.forbidden('Only a manager can close or reopen an inspection');
    }
    const current = normStatus(row.status);
    if (current === 'closed' && !isManager) throw AppError.badRequest('This inspection is closed');
    if (isManager && data.inspectorId !== undefined && current === 'pending' && data.inspectorId) data.status = data.status || 'assigned';
    // Starting to fill the checklist moves an assigned inspection into progress.
    if (!data.status && current === 'assigned' && (data.checklist || data.remarks)) data.status = 'in_progress';
    if (data.status === 'completed') {
      const list = data.checklist || row.checklist || [];
      const left = list.filter((c) => !c.result).length;
      if (left) throw AppError.badRequest(`Mark every checklist item before submitting (${left} left)`);
      data.completedAt = new Date();
      data.completedById = actor.id;
      // Failed / action-needed items or open issues → needs follow-up.
      const openIssues = row.issues.filter((i) => !['resolved', 'verified'].includes(i.status)).length;
      if (flagged(list) || openIssues) data.status = 'follow_up';
    }
    if (data.status === 'in_progress' && ['completed', 'follow_up'].includes(current)) {
      data.completedAt = null;
      data.completedById = null;
    }
    if (data.status === 'closed' && row.issues.some((i) => !['resolved', 'verified'].includes(i.status))) {
      throw AppError.badRequest('Resolve all open issues before closing the inspection');
    }
    const updated = await prisma.inspection.update({ where: { id }, data });
    activity.record({ userId: actor.id, action: 'inspection.updated', entityType: 'inspection', entityId: id, req });
    if (['completed', 'follow_up'].includes(data.status) && row.createdById && row.createdById !== actor.id) {
      notify({ userId: row.createdById, type: 'inspection.completed', title: data.status === 'follow_up' ? 'Inspection needs follow-up' : 'Inspection completed', message: `${row.title} was submitted${data.status === 'follow_up' ? ' with items needing corrective action' : ''}`, entityType: 'inspection', entityId: id });
    }
    if (isManager && payload.inspectorId && payload.inspectorId !== row.inspectorId && payload.inspectorId !== actor.id) {
      notify({ userId: payload.inspectorId, type: 'inspection.assigned', title: 'Inspection assigned to you', message: row.title, entityType: 'inspection', entityId: id });
    }
    return { ...updated, status: normStatus(updated.status) };
  },

  async remove(id, actor, req) {
    const row = await getInspection(id);
    await canSee(actor, row);
    await prisma.inspection.update({ where: { id }, data: { deletedAt: new Date() } });
    activity.record({ userId: actor.id, action: 'inspection.deleted', entityType: 'inspection', entityId: id, req });
    return { success: true };
  },

  async addIssue(id, payload, actor, req) {
    const row = await getInspection(id);
    if (row.inspectorId !== actor.id && !hasPerm(actor, 'inspections.manage')) throw AppError.forbidden('You do not have permission to do this');
    await canSee(actor, row);
    const issue = await prisma.inspectionIssue.create({
      data: {
        inspectionId: id,
        description: payload.description,
        severity: payload.severity || 'medium',
        assignedToId: payload.assignedToId || null,
        correctiveAction: payload.correctiveAction || null,
        dueDate: payload.dueDate || null,
      },
    });
    if (['closed', 'completed'].includes(row.status)) await prisma.inspection.update({ where: { id }, data: { status: 'follow_up' } });
    activity.record({ userId: actor.id, action: 'inspection.issue_added', entityType: 'inspection', entityId: id, req });
    if (issue.assignedToId && issue.assignedToId !== actor.id) {
      notify({ userId: issue.assignedToId, type: 'inspection.issue_assigned', title: 'Inspection issue assigned', message: `${row.title}: ${payload.description.slice(0, 120)}`, entityType: 'inspection', entityId: id });
    }
    return issue;
  },

  async updateIssue(issueId, payload, actor, req) {
    const issue = await prisma.inspectionIssue.findUnique({ where: { id: issueId }, include: { inspection: true } });
    if (!issue || issue.inspection.deletedAt) throw AppError.notFound('Issue not found');
    if (issue.assignedToId !== actor.id) await assertProjectAccess(actor, issue.inspection.projectId);
    // Assignees (without manage rights) may only progress status / note the action taken.
    const isManager = hasPerm(actor, 'inspections.manage');
    if (!isManager) {
      if (issue.assignedToId !== actor.id) throw AppError.forbidden('Only the assignee or an inspector can update this issue');
      for (const k of Object.keys(payload)) if (!['status', 'correctiveAction'].includes(k)) delete payload[k];
      if (payload.status === 'verified') throw AppError.forbidden('Only an inspector can verify a fix');
    }
    const updated = await prisma.inspectionIssue.update({ where: { id: issueId }, data: payload });
    // When the last open issue is fixed, a follow-up inspection becomes completed.
    if (payload.status && ['resolved', 'verified'].includes(payload.status) && issue.inspection.status === 'follow_up') {
      const stillOpen = await prisma.inspectionIssue.count({ where: { inspectionId: issue.inspectionId, status: { in: ['open', 'in_progress'] } } });
      if (!stillOpen) await prisma.inspection.update({ where: { id: issue.inspectionId }, data: { status: 'completed' } });
    }
    activity.record({ userId: actor.id, action: 'inspection.issue_updated', entityType: 'inspection', entityId: issue.inspectionId, req });
    if (payload.assignedToId && payload.assignedToId !== issue.assignedToId && payload.assignedToId !== actor.id) {
      notify({ userId: payload.assignedToId, type: 'inspection.issue_assigned', title: 'Inspection issue assigned', message: `${issue.inspection.title}: ${issue.description.slice(0, 120)}`, entityType: 'inspection', entityId: issue.inspectionId });
    }
    if (payload.status === 'resolved' && issue.inspection.createdById && issue.inspection.createdById !== actor.id) {
      notify({ userId: issue.inspection.createdById, type: 'inspection.issue_resolved', title: 'Issue marked resolved', message: `${issue.inspection.title}: ${issue.description.slice(0, 120)} — please verify.`, entityType: 'inspection', entityId: issue.inspectionId });
    }
    return updated;
  },

  // Issues across inspections (e.g. "assigned to me").
  async issues(query, actor) {
    const where = { inspection: { deletedAt: null } };
    if (query.mine === 'true') where.assignedToId = actor.id;
    if (query.status === 'open') where.status = { in: ['open', 'in_progress'] };
    else if (query.status) where.status = query.status;
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null && query.mine !== 'true') where.inspection.projectId = { in: allowed };
    const rows = await prisma.inspectionIssue.findMany({ where, include: { inspection: { select: { id: true, title: true, projectId: true } } }, orderBy: [{ dueDate: 'asc' }, { id: 'desc' }], take: 300 });
    const [projects, users] = await Promise.all([projectNames(rows.map((r) => r.inspection.projectId)), userNames(rows.map((r) => r.assignedToId))]);
    return rows.map((r) => ({ ...r, projectName: projects.get(r.inspection.projectId)?.name || null, assignedToName: users.get(r.assignedToId) || null }));
  },

  // Printable inspection report (browser Save-as-PDF).
  // Counters for the inspections header.
  async stats(actor) {
    const where = { deletedAt: null };
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null) where.OR = [{ projectId: { in: allowed } }, { inspectorId: actor.id }];
    const rows = await prisma.inspection.findMany({ where, select: { status: true, dueDate: true, inspectorId: true } });
    const today = new Date(new Date().toDateString());
    const out = { pending: 0, assigned: 0, in_progress: 0, completed: 0, follow_up: 0, closed: 0, overdue: 0, mine: 0 };
    for (const r of rows) {
      const st = normStatus(r.status);
      out[st] = (out[st] || 0) + 1;
      const pending = OPEN_STATES.includes(st);
      if (pending && r.dueDate && new Date(r.dueDate) < today) out.overdue += 1;
      if (pending && r.inspectorId === actor.id) out.mine += 1;
    }
    return out;
  },

  async report(id, actor) {
    const r = await this.get(id, actor);
    const company = (await prisma.company.findFirst()) || {};
    const photos = await prisma.storedFile.findMany({ where: { entityType: 'inspection', entityId: id, mimeType: { startsWith: 'image/' } }, select: { data: true, name: true, caption: true, takenAt: true, createdAt: true }, take: 24 });
    const RES = { pass: '<b style="color:#16a34a">PASS</b>', fail: '<b style="color:#dc2626">FAIL</b>', action: '<b style="color:#d97706">ACTION NEEDED</b>', na: '<span style="color:#94a3b8">N/A</span>' };
    const rows = (r.checklist || []).map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.item)}</td><td>${RES[c.result] || '—'}</td><td>${esc(c.remark)}</td></tr>`).join('');
    const issues = r.issues.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.description)}</td><td style="text-transform:capitalize">${esc(i.severity)}</td><td>${esc(i.assignedToName || '—')}</td><td>${esc(i.correctiveAction || '—')}</td><td>${fmt(i.dueDate)}</td><td style="text-transform:capitalize">${esc(i.status.replace('_', ' '))}</td></tr>`).join('');
    const pics = photos.map((p) => `<figure><img src="${p.data}" alt=""/><figcaption>${esc(p.caption || p.name || '')} · ${p.takenAt ? `Taken ${new Date(p.takenAt).toLocaleString('en-GB')}` : `Uploaded ${fmt(p.createdAt)}`}</figcaption></figure>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Inspection #${r.id}</title><style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;margin:0;padding:32px;font-size:12.5px}
.top{display:flex;justify-content:space-between;border-bottom:3px solid #4F46E5;padding-bottom:12px;margin-bottom:16px}
h1{margin:0;color:#312E81;font-size:22px;text-transform:uppercase}h2{font-size:13px;color:#3730A3;text-transform:uppercase;margin:20px 0 6px}
table{width:100%;border-collapse:collapse}th{background:#EEF2FF;color:#3730A3;text-align:left;padding:6px 8px;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.kv td:first-child{color:#6b7280;width:160px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}img{width:100%;height:150px;object-fit:cover;border-radius:6px}figcaption{font-size:10px;color:#6b7280}
.sig{display:flex;justify-content:space-between;margin-top:48px}.sig div{border-top:1px solid #9ca3af;width:200px;text-align:center;padding-top:4px}
@media print{body{padding:0}}</style></head><body>
<div class="top"><div><b style="font-size:18px">${esc(company.name || '')}</b><div style="color:#6b7280">${esc(company.address || '')}</div></div><div style="text-align:right"><h1>Inspection Report</h1><div>#${r.id} · ${fmt(r.date)}</div></div></div>
<table class="kv"><tr><td>Project</td><td><b>${esc(r.projectName)}</b></td></tr><tr><td>Inspection</td><td>${esc(r.title)}</td></tr><tr><td>Inspector</td><td>${esc(r.inspectorName || '—')}</td></tr><tr><td>Status</td><td style="text-transform:capitalize">${esc(r.status.replace('_', ' '))}${r.completedAt ? ` — submitted ${new Date(r.completedAt).toLocaleString('en-GB')}` : ''}</td></tr><tr><td>Score</td><td>${r.score.pct == null ? '—' : `${r.score.pct}% (${r.score.pass} pass / ${r.score.fail} fail)`}</td></tr></table>
<h2>Checklist</h2><table><thead><tr><th>#</th><th>Item</th><th>Result</th><th>Remark</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No checklist</td></tr>'}</tbody></table>
${r.instructions ? `<h2>Scope / Instructions</h2><p style="white-space:pre-wrap">${esc(r.instructions)}</p>` : ''}
${r.remarks ? `<h2>Remarks</h2><p style="white-space:pre-wrap">${esc(r.remarks)}</p>` : ''}
<h2>Issues &amp; Corrective Actions</h2><table><thead><tr><th>#</th><th>Issue</th><th>Severity</th><th>Assigned</th><th>Corrective action</th><th>Due</th><th>Status</th></tr></thead><tbody>${issues || '<tr><td colspan="7">No issues identified</td></tr>'}</tbody></table>
${pics ? `<h2>Photographs</h2><div class="grid">${pics}</div>` : ''}
<div class="sig"><div>Inspected by</div><div>Site Incharge</div><div>Approved by</div></div>
</body></html>`;
    return { html };
  },
};

module.exports = inspectionsService;
