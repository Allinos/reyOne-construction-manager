'use strict';

const prisma = require('../../config/prisma');

const financeRepository = {
  // --- Payments ---
  createPayment(data) {
    return prisma.payment.create({ data });
  },
  findPayment(id) {
    return prisma.payment.findUnique({ where: { id } });
  },
  updatePayment(id, data) {
    return prisma.payment.update({ where: { id }, data });
  },
  deletePayment(id) {
    return prisma.payment.delete({ where: { id } });
  },
  async listPayments({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.payment.findMany({ where, skip, take, orderBy: { date: 'desc' } }),
      prisma.payment.count({ where }),
    ]);
    return { rows, total };
  },
  // Project ids whose name / reference / client match a search term (payments
  // have no relation to Project, so we resolve ids first).
  async searchProjectIds(term) {
    const rows = await prisma.project.findMany({
      where: {
        OR: [
          { name: { contains: term } },
          { referenceNumber: { contains: term } },
          { clientName: { contains: term } },
        ],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  },
  sumPayments(where) {
    return prisma.payment.aggregate({ where, _sum: { amount: true } });
  },
  paymentsByAccount(where = {}) {
    return prisma.payment.groupBy({ by: ['account'], where, _sum: { amount: true } });
  },
  paymentsByPhase(projectId) {
    return prisma.payment.groupBy({ by: ['phaseId'], where: { projectId }, _sum: { amount: true } });
  },
  paymentsByProject() {
    return prisma.payment.groupBy({ by: ['projectId'], _sum: { amount: true } });
  },
  listProjectsBasic() {
    return prisma.project.findMany({
      where: { deletedAt: null },
      select: { id: true, referenceNumber: true, name: true, clientName: true, status: true, projectAmount: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  // --- Expenses ---
  createExpense(data) {
    return prisma.expense.create({ data });
  },
  findExpense(id) {
    return prisma.expense.findUnique({ where: { id } });
  },
  updateExpense(id, data) {
    return prisma.expense.update({ where: { id }, data });
  },
  deleteExpense(id) {
    return prisma.expense.delete({ where: { id } });
  },
  async listExpenses({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.expense.findMany({ where, skip, take, orderBy: { date: 'desc' } }),
      prisma.expense.count({ where }),
    ]);
    return { rows, total };
  },
  sumExpenses(where) {
    return prisma.expense.aggregate({ where, _sum: { amount: true } });
  },
  expensesByAccount(where = {}) {
    return prisma.expense.groupBy({ by: ['account'], where, _sum: { amount: true } });
  },
  expensesByCategory(where = {}) {
    return prisma.expense.groupBy({ by: ['category'], where, _sum: { amount: true } });
  },

  // --- analytics ---
  sumProjectAmount() {
    return prisma.project.aggregate({ where: { deletedAt: null }, _sum: { projectAmount: true } });
  },
  revenueSeries(fromDate, fmt) {
    return prisma.$queryRaw`SELECT DATE_FORMAT(date, ${fmt}) period, SUM(amount) total
      FROM payments WHERE date >= ${fromDate} GROUP BY period ORDER BY period`;
  },
  expenseSeries(fromDate, fmt) {
    return prisma.$queryRaw`SELECT DATE_FORMAT(date, ${fmt}) period, SUM(amount) total
      FROM expenses WHERE date >= ${fromDate} GROUP BY period ORDER BY period`;
  },

  // --- cross-references (read-only) ---
  findProject(id) {
    return prisma.project.findFirst({ where: { id, deletedAt: null } });
  },
  async projectAssigneeUserIds(projectId) {
    const rows = await prisma.projectAssignee.findMany({ where: { projectId }, select: { userId: true } });
    return rows.map((r) => r.userId);
  },
  projectExpenses(projectId) {
    return prisma.expense.findMany({
      where: { scope: 'PROJECT', projectId },
      orderBy: { date: 'desc' },
      take: 200,
    });
  },
  findPhase(id) {
    return prisma.projectPhase.findUnique({ where: { id } });
  },
  projectPhases(projectId) {
    return prisma.projectPhase.findMany({
      where: { projectId },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    });
  },
  getSetting(group, key) {
    return prisma.setting.findUnique({ where: { group_key: { group, key } } });
  },
};

module.exports = financeRepository;
