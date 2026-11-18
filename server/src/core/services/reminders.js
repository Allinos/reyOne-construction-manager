'use strict';

/**
 * Background reminders. Runs shortly after boot and then every few hours.
 * Each reminder is sent at most once per recipient per entity per day.
 *  - Installments due within 3 days or overdue → finance users
 *  - Overdue inspection issues → assignee
 *  - Material requests pending > 2 days → approvers
 *  - Projects past their target completion → project assignees (weekly)
 */
const prisma = require('../../config/prisma');
const { projectCollections } = require('./collections');
const { usersWithPermission } = require('./access');
const push = require('./push');

const DAY = 86400000;
const fmt = (d) => new Date(d).toLocaleDateString('en-GB');
const money = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

async function sendOnce(userIds, payload, windowMs = DAY - 60000) {
  const since = new Date(Date.now() - windowMs);
  const unique = [...new Set(userIds.filter(Boolean))];
  if (!unique.length) return 0;
  const already = await prisma.notification.findMany({
    where: { userId: { in: unique }, type: payload.type, entityType: payload.entityType, entityId: String(payload.entityId), createdAt: { gte: since } },
    select: { userId: true },
  });
  const skip = new Set(already.map((a) => a.userId));
  const targets = unique.filter((u) => !skip.has(u));
  if (!targets.length) return 0;
  await prisma.notification.createMany({ data: targets.map((userId) => ({ userId, ...payload, entityId: String(payload.entityId) })) });
  push.sendToUsers(targets, { title: payload.title, body: payload.message, data: { type: payload.type, entityType: payload.entityType, entityId: payload.entityId } });
  return targets.length;
}

async function isEnabled(key) {
  const m = await prisma.module.findUnique({ where: { key } });
  return Boolean(m?.enabled);
}

async function runReminders() {
  let sent = 0;
  const now = Date.now();

  if (await isEnabled('finance')) {
    const financeUsers = await usersWithPermission('finance.read');
    const rows = await projectCollections({ status: { not: 'completed' } });
    for (const p of rows) {
      for (const i of p.installments) {
        if (i.balance <= 0.004) continue;
        const due = new Date(i.dueDate).getTime();
        if (i.status === 'overdue') {
          // eslint-disable-next-line no-await-in-loop
          sent += await sendOnce(financeUsers, { type: 'payment.overdue', title: `Overdue: ${i.title} · ${p.projectName}`.slice(0, 190), message: `${money(i.balance)} from ${p.clientName} was due on ${fmt(i.dueDate)}.`, entityType: 'project', entityId: p.projectId });
        } else if (due - now <= 3 * DAY) {
          // eslint-disable-next-line no-await-in-loop
          sent += await sendOnce(financeUsers, { type: 'payment.due_soon', title: `Installment due ${fmt(i.dueDate)} · ${p.projectName}`.slice(0, 190), message: `${i.title}: ${money(i.balance)} from ${p.clientName}.`, entityType: 'project', entityId: p.projectId });
        }
      }
    }
  }

  if (await isEnabled('inspections')) {
    const issues = await prisma.inspectionIssue.findMany({
      where: { status: { in: ['open', 'in_progress'] }, dueDate: { lt: new Date() }, assignedToId: { not: null }, inspection: { deletedAt: null } },
      include: { inspection: { select: { id: true, title: true } } },
    });
    for (const i of issues) {
      // eslint-disable-next-line no-await-in-loop
      sent += await sendOnce([i.assignedToId], { type: 'inspection.issue_overdue', title: `Overdue issue: ${i.inspection.title}`.slice(0, 190), message: `${i.description.slice(0, 140)} (due ${fmt(i.dueDate)})`, entityType: 'inspection', entityId: i.inspection.id });
    }
  }

  if (await isEnabled('inspections')) {
    const late = await prisma.inspection.findMany({ where: { deletedAt: null, status: { in: ['assigned', 'in_progress', 'open'] }, dueDate: { lt: new Date() }, inspectorId: { not: null } }, select: { id: true, title: true, dueDate: true, inspectorId: true } });
    for (const i of late) {
      // eslint-disable-next-line no-await-in-loop
      sent += await sendOnce([i.inspectorId], { type: 'inspection.overdue', title: `Inspection overdue: ${i.title}`.slice(0, 190), message: `Was due ${fmt(i.dueDate)}.`, entityType: 'inspection', entityId: i.id });
    }
  }

  if (await isEnabled('queries')) {
    const qs = await prisma.query.findMany({ where: { deletedAt: null, status: { in: ['assigned', 'awaiting_response', 'in_progress'] }, dueDate: { lt: new Date() } }, select: { id: true, number: true, title: true, dueDate: true, assigneeIds: true } });
    for (const q of qs) {
      const to = (Array.isArray(q.assigneeIds) ? q.assigneeIds : []).map(Number);
      // eslint-disable-next-line no-await-in-loop
      if (to.length) sent += await sendOnce(to, { type: 'query.overdue', title: `Response overdue: ${q.number || 'query'} ${q.title}`.slice(0, 190), message: `Response was due ${fmt(q.dueDate)}.`, entityType: 'query', entityId: q.id });
    }
  }

  if (await isEnabled('vendors')) {
    const bills = await prisma.expense.findMany({ where: { vendorId: { not: null }, paymentStatus: { in: ['CREDIT', 'PARTIAL'] }, dueDate: { lte: new Date(now + 2 * DAY) } }, select: { id: true, vendorId: true, billNumber: true, amount: true, amountPaid: true, dueDate: true } });
    if (bills.length) {
      const payers = await usersWithPermission('vendors.pay');
      const vendors = await prisma.vendor.findMany({ where: { id: { in: [...new Set(bills.map((b) => b.vendorId))] } }, select: { id: true, name: true } });
      const vn = new Map(vendors.map((v) => [v.id, v.name]));
      for (const b of bills) {
        const overdue = b.dueDate < new Date(new Date().toDateString());
        // eslint-disable-next-line no-await-in-loop
        sent += await sendOnce(payers, { type: overdue ? 'vendor.bill_overdue' : 'vendor.bill_due', title: `${overdue ? 'Overdue' : 'Due soon'}: ${vn.get(b.vendorId) || 'vendor'} bill ${b.billNumber || `#${b.id}`}`.slice(0, 190), message: `${money(Number(b.amount) - Number(b.amountPaid))} due ${fmt(b.dueDate)}.`, entityType: 'vendor', entityId: b.vendorId });
      }
    }
  }

  if (await isEnabled('materials')) {
    const latePOs = await prisma.purchaseOrder.findMany({ where: { deletedAt: null, status: { in: ['ordered', 'partially_received'] }, expectedDate: { lt: new Date() } }, select: { id: true, number: true, createdById: true, expectedDate: true } });
    for (const po of latePOs) {
      // eslint-disable-next-line no-await-in-loop
      if (po.createdById) sent += await sendOnce([po.createdById], { type: 'materials.po_late', title: `${po.number} delivery is late`, message: `Expected ${fmt(po.expectedDate)} — follow up with the vendor.`, entityType: 'purchase_order', entityId: po.id });
    }
    const stale = await prisma.materialRequest.findMany({ where: { status: 'pending', createdAt: { lt: new Date(now - 2 * DAY) } }, select: { id: true } });
    if (stale.length) {
      const approvers = await usersWithPermission('materials.approve');
      for (const r of stale) {
        // eslint-disable-next-line no-await-in-loop
        sent += await sendOnce(approvers, { type: 'materials.request', title: `Material request #${r.id} awaiting approval`, message: 'Pending for more than 2 days.', entityType: 'material_request', entityId: r.id });
      }
    }
  }

  if (await isEnabled('projects')) {
    const late = await prisma.project.findMany({ where: { deletedAt: null, status: { not: 'completed' }, endDate: { lt: new Date() } }, select: { id: true, name: true, endDate: true, progress: true, assignees: { select: { userId: true } } } });
    for (const p of late) {
      // eslint-disable-next-line no-await-in-loop
      sent += await sendOnce(p.assignees.map((a) => a.userId), { type: 'deadline', title: `Past target completion: ${p.name}`.slice(0, 190), message: `Target was ${fmt(p.endDate)}; progress ${p.progress}%.`, entityType: 'project', entityId: p.id }, 7 * DAY - 60000);
    }
  }
  return sent;
}

let timer = null;
function startReminders({ intervalMs = 4 * 60 * 60 * 1000, initialDelayMs = 60 * 1000 } = {}) {
  if (timer || process.env.DISABLE_REMINDERS === 'true') return;
  const tick = () => runReminders().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('reminders failed:', err.message);
  });
  setTimeout(tick, initialDelayMs).unref();
  timer = setInterval(tick, intervalMs);
  timer.unref();
}

module.exports = { runReminders, startReminders };
