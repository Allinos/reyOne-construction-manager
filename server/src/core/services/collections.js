'use strict';

const prisma = require('../../config/prisma');

const num = (v) => Number(v || 0);
const r2 = (n) => Math.round(n * 100) / 100;
const DAY = 86400000;

/**
 * Collections per project: contract value, received, outstanding, and the
 * installment schedule with payments allocated FIFO by due date. Each
 * installment gets a status: paid | partial | overdue | due_soon | upcoming.
 */
async function projectCollections(where = {}) {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, ...where },
    select: { id: true, name: true, referenceNumber: true, clientName: true, status: true, projectAmount: true, endDate: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!projects.length) return [];
  const ids = projects.map((p) => p.id);
  const [paid, schedules] = await Promise.all([
    prisma.payment.groupBy({ by: ['projectId'], where: { projectId: { in: ids } }, _sum: { amount: true }, _max: { date: true } }),
    prisma.paymentSchedule.findMany({ where: { projectId: { in: ids } }, orderBy: [{ dueDate: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }] }),
  ]);
  const paidBy = new Map(paid.map((p) => [p.projectId, { sum: num(p._sum.amount), last: p._max.date }]));
  const today = new Date(); today.setHours(0, 0, 0, 0);

  return projects.map((p) => {
    const value = num(p.projectAmount);
    const received = paidBy.get(p.id)?.sum || 0;
    let pool = received;
    const installments = schedules.filter((s) => s.projectId === p.id).map((s) => {
      const amount = num(s.amount);
      const alloc = Math.min(amount, Math.max(0, pool));
      pool -= alloc;
      const due = new Date(s.dueDate);
      const balance = r2(amount - alloc);
      let status = 'upcoming';
      if (balance <= 0.004) status = 'paid';
      else if (due < today) status = 'overdue';
      else if (due - today <= 7 * DAY) status = alloc > 0 ? 'partial' : 'due_soon';
      else if (alloc > 0) status = 'partial';
      return { ...s, amount, paid: r2(alloc), balance, status };
    });
    const overdueAmount = r2(installments.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.balance, 0));
    const next = installments.find((i) => i.balance > 0.004) || null;
    return {
      projectId: p.id,
      projectName: p.name,
      referenceNumber: p.referenceNumber,
      clientName: p.clientName,
      status: p.status,
      value: r2(value),
      received: r2(received),
      outstanding: r2(Math.max(0, value - received)),
      lastPaymentDate: paidBy.get(p.id)?.last || null,
      scheduled: r2(installments.reduce((s, i) => s + i.amount, 0)),
      overdueAmount,
      nextDue: next ? { id: next.id, title: next.title, dueDate: next.dueDate, balance: next.balance, status: next.status } : null,
      installments,
    };
  });
}

function totals(rows) {
  const sum = (f) => r2(rows.reduce((s, r) => s + r[f], 0));
  return { value: sum('value'), received: sum('received'), outstanding: sum('outstanding'), overdue: sum('overdueAmount'), projects: rows.length };
}

module.exports = { projectCollections, totals };
