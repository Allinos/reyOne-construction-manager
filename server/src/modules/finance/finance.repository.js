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
  sumPayments(where) {
    return prisma.payment.aggregate({ where, _sum: { amount: true } });
  },
  paymentsByAccount(where = {}) {
    return prisma.payment.groupBy({ by: ['account'], where, _sum: { amount: true } });
  },
  paymentsByPhase(projectId) {
    return prisma.payment.groupBy({ by: ['phaseId'], where: { projectId }, _sum: { amount: true } });
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

  // --- cross-references (read-only) ---
  findProject(id) {
    return prisma.project.findFirst({ where: { id, deletedAt: null } });
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
