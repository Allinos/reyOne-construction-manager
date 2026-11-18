'use strict';

/**
 * Role-aware dashboard. Every section is included only when its module is
 * enabled AND the user holds the permission, so an Employee never sees company
 * finance while an Accountant sees collections, payroll and expenses.
 */
const prisma = require('../../config/prisma');
const { hasPerm, accessibleProjectIds } = require('../../core/services/access');
const { projectCollections, totals } = require('../../core/services/collections');
const { keyOf } = require('../../core/services/people');

const num = (v) => Number(v || 0);
const r2 = (n) => Math.round(n * 100) / 100;
const startOfMonth = (offset = 0) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 1); };

async function enabledModules() {
  const rows = await prisma.module.findMany({ where: { enabled: true }, select: { key: true } });
  return new Set(rows.map((r) => r.key));
}

async function insights(actor) {
  const on = await enabledModules();
  const can = (k) => hasPerm(actor, k);
  const allowed = await accessibleProjectIds(actor);
  const projectWhere = { deletedAt: null, ...(allowed !== null ? { id: { in: allowed } } : {}) };
  const out = { attention: [] };
  const tasks = [];

  // --- my work (everyone) ---
  tasks.push((async () => {
    const mine = {};
    if (on.has('projects')) {
      const assigned = await prisma.project.findMany({
        where: { deletedAt: null, status: { not: 'completed' }, assignees: { some: { userId: actor.id } } },
        select: { id: true, name: true, referenceNumber: true, progress: true, endDate: true, status: true },
        orderBy: { endDate: 'asc' }, take: 8,
      });
      mine.projects = assigned;
    }
    if (on.has('queries') && can('queries.read')) {
      const qs = await prisma.query.findMany({ where: { deletedAt: null, status: { in: ['open', 'in_progress', 'assigned', 'awaiting_response', 'responded'] } }, select: { id: true, title: true, priority: true, status: true, dueDate: true, assigneeIds: true, createdById: true } });
      // Waiting on me to respond, or a response waiting for me to review.
      const forMe = qs.filter((q) => ['assigned', 'in_progress', 'awaiting_response'].includes(q.status) && (Array.isArray(q.assigneeIds) ? q.assigneeIds : []).map(Number).includes(actor.id));
      const toReview = qs.filter((q) => q.status === 'responded' && q.createdById === actor.id);
      mine.queries = forMe.length;
      const late = forMe.filter((q) => q.dueDate && q.dueDate < new Date()).length;
      if (forMe.length) out.attention.push({ kind: 'queries', count: forMe.length, label: `${forMe.length} quer${forMe.length === 1 ? 'y needs' : 'ies need'} your response${late ? ` · ${late} overdue` : ''}`, to: forMe.length === 1 ? `/queries?id=${forMe[0].id}` : '/queries', tone: late || forMe.some((q) => q.priority === 'urgent') ? 'red' : 'sky' });
      if (toReview.length) out.attention.push({ kind: 'queries_answered', count: toReview.length, label: `${toReview.length} of your quer${toReview.length === 1 ? 'y has' : 'ies have'} been answered — review & resolve`, to: toReview.length === 1 ? `/queries?id=${toReview[0].id}` : '/queries', tone: 'sky' });
    }
    if (on.has('inspections')) {
      const todo = await prisma.inspection.findMany({ where: { inspectorId: actor.id, deletedAt: null, status: { in: ['assigned', 'in_progress', 'open'] } }, select: { id: true, dueDate: true } });
      if (todo.length) {
        const late = todo.filter((i) => i.dueDate && i.dueDate < new Date(new Date().toDateString())).length;
        out.attention.push({ kind: 'inspections_assigned', count: todo.length, label: `${todo.length} inspection${todo.length === 1 ? '' : 's'} assigned to you${late ? ` · ${late} overdue` : ''}`, to: todo.length === 1 ? `/inspections/${todo[0].id}` : '/inspections', tone: late ? 'red' : 'sky' });
      }
      const issues = await prisma.inspectionIssue.findMany({ where: { assignedToId: actor.id, status: { in: ['open', 'in_progress'] }, inspection: { deletedAt: null } }, select: { dueDate: true } });
      mine.issues = issues.length;
      if (issues.length) {
        const overdue = issues.filter((i) => i.dueDate && i.dueDate < new Date()).length;
        out.attention.push({ kind: 'issues', count: issues.length, label: `${issues.length} inspection issue(s) to fix${overdue ? ` · ${overdue} overdue` : ''}`, to: '/inspections', tone: overdue ? 'red' : 'amber' });
      }
    }
    out.mine = mine;
  })());

  // --- approvals waiting on me ---
  if (on.has('projects') && can('projects.approve')) {
    tasks.push((async () => {
      const n = await prisma.projectApproval.count({ where: { status: 'pending', ...(allowed !== null ? { projectId: { in: allowed } } : {}) } });
      if (n) {
        const first = await prisma.projectApproval.findFirst({ where: { status: 'pending', ...(allowed !== null ? { projectId: { in: allowed } } : {}) }, orderBy: { id: 'asc' }, select: { projectId: true } });
        out.attention.push({ kind: 'approvals', count: n, label: `${n} project request(s) awaiting approval`, to: n === 1 ? `/projects/${first.projectId}` : '/projects', tone: 'amber' });
      }
    })());
  }
  if (on.has('materials') && can('materials.approve')) {
    tasks.push((async () => {
      const n = await prisma.materialRequest.count({ where: { status: 'pending' } });
      if (n) out.attention.push({ kind: 'material_requests', count: n, label: `${n} material request(s) to review`, to: '/materials', tone: 'amber' });
    })());
  }
  if (on.has('materials') && can('materials.manage')) {
    tasks.push((async () => {
      const n = await prisma.materialRequest.count({ where: { status: { in: ['approved', 'partially_fulfilled'] } } });
      if (n) out.attention.push({ kind: 'dispatch', count: n, label: `${n} approved request(s) to dispatch`, to: '/materials', tone: 'sky' });
    })());
  }

  // --- projects ---
  if (on.has('projects') && can('projects.read')) {
    tasks.push((async () => {
      const [rows, overdue, upcoming] = await Promise.all([
        prisma.project.findMany({ where: projectWhere, select: { status: true, progress: true } }),
        prisma.project.findMany({ where: { ...projectWhere, status: { not: 'completed' }, endDate: { lt: new Date() } }, select: { id: true, name: true, endDate: true, progress: true }, orderBy: { endDate: 'asc' }, take: 5 }),
        prisma.project.findMany({ where: { ...projectWhere, status: { not: 'completed' }, endDate: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) } }, select: { id: true, name: true, endDate: true, progress: true }, orderBy: { endDate: 'asc' }, take: 6 }),
      ]);
      const active = rows.filter((r) => r.status !== 'completed');
      const byStatus = {};
      for (const r of rows) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      out.projects = {
        total: rows.length,
        active: active.length,
        completed: rows.length - active.length,
        avgProgress: active.length ? Math.round(active.reduce((s, r) => s + r.progress, 0) / active.length) : 0,
        byStatus,
        overdue,
        upcoming,
      };
      if (overdue.length) out.attention.push({ kind: 'late_projects', count: overdue.length, label: `${overdue.length} project(s) past target completion`, to: '/projects', tone: 'red' });
    })());
  }

  // --- finance ---
  if (on.has('finance') && can('finance.read')) {
    tasks.push((async () => {
      const [rows, thisMonthIn, lastMonthIn, thisMonthOut] = await Promise.all([
        projectCollections(projectWhere.id ? { id: projectWhere.id } : {}),
        prisma.payment.aggregate({ where: { date: { gte: startOfMonth(0) } }, _sum: { amount: true } }),
        prisma.payment.aggregate({ where: { date: { gte: startOfMonth(-1), lt: startOfMonth(0) } }, _sum: { amount: true } }),
        prisma.expense.aggregate({ where: { date: { gte: startOfMonth(0) } }, _sum: { amount: true } }),
      ]);
      const t = totals(rows);
      const dueSoon = rows.flatMap((p) => p.installments.filter((i) => ['due_soon', 'overdue'].includes(i.status)).map((i) => ({ projectId: p.projectId, projectName: p.projectName, clientName: p.clientName, title: i.title, dueDate: i.dueDate, balance: i.balance, status: i.status })))
        .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0, 8);
      out.finance = {
        ...t,
        collectedThisMonth: r2(num(thisMonthIn._sum.amount)),
        collectedLastMonth: r2(num(lastMonthIn._sum.amount)),
        expensesThisMonth: r2(num(thisMonthOut._sum.amount)),
        dueSoon,
      };
      const od = dueSoon.filter((d) => d.status === 'overdue');
      if (od.length) out.attention.push({ kind: 'overdue_installments', count: od.length, label: `${od.length} overdue client installment(s)`, to: '/finance/collections', tone: 'red' });
    })());
  }

  // --- attendance today ---
  if (on.has('attendance') && can('attendance.read')) {
    tasks.push((async () => {
      const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      const [records, users, wf] = await Promise.all([
        prisma.attendanceRecord.groupBy({ by: ['status'], where: { date: today }, _count: { _all: true } }),
        prisma.user.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
        prisma.workforce.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
      ]);
      const c = { present: 0, half_day: 0, absent: 0, leave: 0 };
      for (const r of records) c[r.status] = r._count._all;
      const marked = c.present + c.half_day + c.absent + c.leave;
      out.attendance = { ...c, people: users + wf, unmarked: Math.max(0, users + wf - marked) };
      if (can('attendance.mark') && marked === 0 && new Date().getHours() >= 11) out.attention.push({ kind: 'attendance', count: 1, label: "Today's attendance hasn't been marked", to: '/attendance', tone: 'amber' });
    })());
  }

  // --- materials ---
  if (on.has('materials') && can('materials.read')) {
    tasks.push((async () => {
      const [items, sums, pending] = await Promise.all([
        prisma.material.findMany({ where: { deletedAt: null, reorderLevel: { gt: 0 } }, select: { id: true, name: true, unit: true, reorderLevel: true } }),
        prisma.stockMovement.groupBy({ by: ['materialId'], where: { projectId: null }, _sum: { quantity: true } }),
        prisma.materialRequest.count({ where: { status: 'pending', ...(allowed !== null ? { projectId: { in: allowed } } : {}) } }),
      ]);
      const store = new Map(sums.map((s) => [s.materialId, num(s._sum.quantity)]));
      const low = items.filter((m) => (store.get(m.id) || 0) <= num(m.reorderLevel)).map((m) => ({ id: m.id, name: m.name, unit: m.unit, inStore: r2(store.get(m.id) || 0), reorderLevel: num(m.reorderLevel) }));
      out.materials = { lowStock: low.slice(0, 6), lowStockCount: low.length, pendingRequests: pending };
      if (low.length && can('materials.manage')) out.attention.push({ kind: 'low_stock', count: low.length, label: `${low.length} material(s) at or below reorder level`, to: '/materials', tone: 'amber' });
    })());
  }

  // --- payroll ---
  if (on.has('payroll') && can('payroll.read')) {
    tasks.push((async () => {
      const payroll = require('../payroll/payroll.service'); // eslint-disable-line global-require
      const s = await payroll.summary({});
      out.payroll = { month: s.month, ...s.totals };
    })());
  }

  // --- queries & inspections overview ---
  if (on.has('queries') && can('queries.manage')) {
    tasks.push((async () => {
      const [open, urgent] = await Promise.all([
        prisma.query.count({ where: { deletedAt: null, status: { in: ['open', 'in_progress', 'assigned', 'awaiting_response', 'responded'] } } }),
        prisma.query.count({ where: { deletedAt: null, status: { in: ['open', 'in_progress', 'assigned', 'awaiting_response', 'responded'] }, priority: { in: ['urgent', 'high'] } } }),
      ]);
      out.queries = { open, urgent };
    })());
  }
  if (on.has('inspections') && can('inspections.read')) {
    tasks.push((async () => {
      const issues = await prisma.inspectionIssue.groupBy({ by: ['severity'], where: { status: { in: ['open', 'in_progress'] }, inspection: { deletedAt: null, ...(allowed !== null ? { projectId: { in: allowed } } : {}) } }, _count: { _all: true } });
      const bySeverity = Object.fromEntries(issues.map((i) => [i.severity, i._count._all]));
      out.inspections = { openIssues: issues.reduce((s, i) => s + i._count._all, 0), bySeverity };
    })());
  }

  await Promise.all(tasks);
  const order = { red: 0, amber: 1, sky: 2 };
  out.attention.sort((a, b) => (order[a.tone] ?? 3) - (order[b.tone] ?? 3));
  return out;
}

module.exports = { insights, keyOf };
