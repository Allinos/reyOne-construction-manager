'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notify } = require('../../core/services/notify');
const { userNames, projectNames } = require('../../core/services/people');
const { accessibleProjectIds, assertProjectAccess, hasPerm } = require('../../core/services/access');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

function score(checklist = []) {
  const rated = checklist.filter((c) => c.result === 'pass' || c.result === 'fail');
  const pass = rated.filter((c) => c.result === 'pass').length;
  return { total: checklist.length, pass, fail: rated.length - pass, pct: rated.length ? Math.round((pass / rated.length) * 100) : null };
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
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null) where.projectId = query.projectId ? (allowed.includes(query.projectId) ? query.projectId : -1) : { in: allowed };
    const rows = await prisma.inspection.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 200, include: { issues: { select: { status: true, severity: true } } } });
    const [projects, users] = await Promise.all([projectNames(rows.map((r) => r.projectId)), userNames(rows.map((r) => r.inspectorId))]);
    return rows.map(({ issues, checklist, ...r }) => ({
      ...r,
      projectName: projects.get(r.projectId)?.name || null,
      inspectorName: users.get(r.inspectorId) || null,
      score: score(checklist),
      issueCount: issues.length,
      openIssues: issues.filter((i) => !['resolved', 'verified'].includes(i.status)).length,
    }));
  },

  async get(id, actor) {
    const row = await getInspection(id);
    await assertProjectAccess(actor, row.projectId);
    const [projects, users, photos] = await Promise.all([
      projectNames([row.projectId]),
      userNames([row.inspectorId, row.createdById, ...row.issues.map((i) => i.assignedToId)]),
      prisma.storedFile.count({ where: { entityType: 'inspection', entityId: id } }),
    ]);
    return {
      ...row,
      projectName: projects.get(row.projectId)?.name || null,
      inspectorName: users.get(row.inspectorId) || null,
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
    const row = await prisma.inspection.create({
      data: {
        projectId: payload.projectId,
        title: payload.title,
        date: payload.date || new Date(),
        inspectorId: payload.inspectorId || actor.id,
        checklist: checklist || [],
        remarks: payload.remarks || null,
        createdById: actor.id,
      },
    });
    activity.record({ userId: actor.id, action: 'inspection.created', entityType: 'inspection', entityId: row.id, req });
    return row;
  },

  async update(id, payload, actor, req) {
    const row = await getInspection(id);
    await assertProjectAccess(actor, row.projectId);
    if (payload.status === 'closed' && row.issues.some((i) => !['resolved', 'verified'].includes(i.status))) {
      throw AppError.badRequest('Resolve all open issues before closing the inspection');
    }
    const updated = await prisma.inspection.update({ where: { id }, data: payload });
    activity.record({ userId: actor.id, action: 'inspection.updated', entityType: 'inspection', entityId: id, req });
    return updated;
  },

  async remove(id, actor, req) {
    const row = await getInspection(id);
    await assertProjectAccess(actor, row.projectId);
    await prisma.inspection.update({ where: { id }, data: { deletedAt: new Date() } });
    activity.record({ userId: actor.id, action: 'inspection.deleted', entityType: 'inspection', entityId: id, req });
    return { success: true };
  },

  async addIssue(id, payload, actor, req) {
    const row = await getInspection(id);
    await assertProjectAccess(actor, row.projectId);
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
    if (row.status === 'closed') await prisma.inspection.update({ where: { id }, data: { status: 'open' } });
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
  async report(id, actor) {
    const r = await this.get(id, actor);
    const company = (await prisma.company.findFirst()) || {};
    const photos = await prisma.storedFile.findMany({ where: { entityType: 'inspection', entityId: id, mimeType: { startsWith: 'image/' } }, select: { data: true, name: true }, take: 24 });
    const RES = { pass: '<b style="color:#16a34a">PASS</b>', fail: '<b style="color:#dc2626">FAIL</b>', na: '<span style="color:#94a3b8">N/A</span>' };
    const rows = (r.checklist || []).map((c, i) => `<tr><td>${i + 1}</td><td>${esc(c.item)}</td><td>${RES[c.result] || '—'}</td><td>${esc(c.remark)}</td></tr>`).join('');
    const issues = r.issues.map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.description)}</td><td style="text-transform:capitalize">${esc(i.severity)}</td><td>${esc(i.assignedToName || '—')}</td><td>${esc(i.correctiveAction || '—')}</td><td>${fmt(i.dueDate)}</td><td style="text-transform:capitalize">${esc(i.status.replace('_', ' '))}</td></tr>`).join('');
    const pics = photos.map((p) => `<figure><img src="${p.data}" alt=""/><figcaption>${esc(p.name || '')}</figcaption></figure>`).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Inspection #${r.id}</title><style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;margin:0;padding:32px;font-size:12.5px}
.top{display:flex;justify-content:space-between;border-bottom:3px solid #F97316;padding-bottom:12px;margin-bottom:16px}
h1{margin:0;color:#F97316;font-size:22px;text-transform:uppercase}h2{font-size:13px;color:#9a3412;text-transform:uppercase;margin:20px 0 6px}
table{width:100%;border-collapse:collapse}th{background:#FFF7ED;color:#9a3412;text-align:left;padding:6px 8px;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
.kv td:first-child{color:#6b7280;width:160px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}figure{margin:0}img{width:100%;height:150px;object-fit:cover;border-radius:6px}figcaption{font-size:10px;color:#6b7280}
.sig{display:flex;justify-content:space-between;margin-top:48px}.sig div{border-top:1px solid #9ca3af;width:200px;text-align:center;padding-top:4px}
@media print{body{padding:0}}</style></head><body>
<div class="top"><div><b style="font-size:18px">${esc(company.name || '')}</b><div style="color:#6b7280">${esc(company.address || '')}</div></div><div style="text-align:right"><h1>Inspection Report</h1><div>#${r.id} · ${fmt(r.date)}</div></div></div>
<table class="kv"><tr><td>Project</td><td><b>${esc(r.projectName)}</b></td></tr><tr><td>Inspection</td><td>${esc(r.title)}</td></tr><tr><td>Inspector</td><td>${esc(r.inspectorName || '—')}</td></tr><tr><td>Status</td><td style="text-transform:capitalize">${esc(r.status)}</td></tr><tr><td>Score</td><td>${r.score.pct == null ? '—' : `${r.score.pct}% (${r.score.pass} pass / ${r.score.fail} fail)`}</td></tr></table>
<h2>Checklist</h2><table><thead><tr><th>#</th><th>Item</th><th>Result</th><th>Remark</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No checklist</td></tr>'}</tbody></table>
${r.remarks ? `<h2>Remarks</h2><p style="white-space:pre-wrap">${esc(r.remarks)}</p>` : ''}
<h2>Issues &amp; Corrective Actions</h2><table><thead><tr><th>#</th><th>Issue</th><th>Severity</th><th>Assigned</th><th>Corrective action</th><th>Due</th><th>Status</th></tr></thead><tbody>${issues || '<tr><td colspan="7">No issues identified</td></tr>'}</tbody></table>
${pics ? `<h2>Photographs</h2><div class="grid">${pics}</div>` : ''}
<div class="sig"><div>Inspected by</div><div>Site Incharge</div><div>Approved by</div></div>
</body></html>`;
    return { html };
  },
};

module.exports = inspectionsService;
