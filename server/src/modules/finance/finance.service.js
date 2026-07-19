'use strict';

const { Prisma } = require('@prisma/client');
const repo = require('./finance.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

// Exact decimal arithmetic — never floats for money.
const D = (v) => new Prisma.Decimal(v ?? 0);
const money = (d) => D(d).toFixed(2);

// --- config & validation -------------------------------------------------

async function loadConfig() {
  const [methods, categories, accounts] = await Promise.all([
    repo.getSetting('finance', 'payment_methods'),
    repo.getSetting('finance', 'expense_categories'),
    repo.getSetting('finance', 'accounts'),
  ]);
  return {
    methods: methods?.value || [],
    categories: categories?.value || [],
    accounts: (accounts?.value || []).map((a) => (typeof a === 'string' ? { key: a, name: a } : a)),
  };
}

function assertIn(value, list, label) {
  if (!list.includes(value)) {
    throw AppError.badRequest(`Invalid ${label}: "${value}". Configure it in Settings first.`);
  }
}

async function validateProject(projectId) {
  const project = await repo.findProject(projectId);
  if (!project) throw AppError.badRequest('Project does not exist');
  return project;
}

async function validatePhase(projectId, phaseId) {
  if (phaseId == null) return;
  const phase = await repo.findPhase(phaseId);
  if (!phase || phase.projectId !== projectId) throw AppError.badRequest('Phase does not belong to this project');
}

function dateWhere(query) {
  if (!query.from && !query.to) return undefined;
  const range = {};
  if (query.from) range.gte = query.from;
  if (query.to) range.lte = query.to;
  return range;
}

// --- service -------------------------------------------------------------

const financeService = {
  // ===== Payments =====
  async listPayments(query) {
    const { page, limit, skip, take } = getPagination(query);
    const where = {};
    if (query.projectId) where.projectId = query.projectId;
    if (query.account) where.account = query.account;
    if (query.method) where.method = query.method;
    const d = dateWhere(query);
    if (d) where.date = d;
    const { rows, total } = await repo.listPayments({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async createPayment(payload, actor, req) {
    const config = await loadConfig();
    assertIn(payload.method, config.methods, 'payment method');
    assertIn(payload.account, config.accounts.map((a) => a.key), 'account');
    await validateProject(payload.projectId);
    await validatePhase(payload.projectId, payload.phaseId);

    const payment = await repo.createPayment({
      projectId: payload.projectId,
      phaseId: payload.phaseId ?? null,
      amount: payload.amount,
      date: payload.date,
      method: payload.method,
      account: payload.account,
      notes: payload.notes,
      createdById: actor.id,
    });
    activity.record({ userId: actor.id, action: 'payment.created', entityType: 'payment', entityId: payment.id, req });
    return payment;
  },

  async updatePayment(id, payload, actor, req) {
    const existing = await repo.findPayment(id);
    if (!existing) throw AppError.notFound('Payment not found');
    const config = await loadConfig();
    if (payload.method) assertIn(payload.method, config.methods, 'payment method');
    if (payload.account) assertIn(payload.account, config.accounts.map((a) => a.key), 'account');
    if (payload.phaseId !== undefined) await validatePhase(existing.projectId, payload.phaseId);

    const payment = await repo.updatePayment(id, payload);
    activity.record({ userId: actor.id, action: 'payment.updated', entityType: 'payment', entityId: id, req });
    return payment;
  },

  async deletePayment(id, actor, req) {
    const existing = await repo.findPayment(id);
    if (!existing) throw AppError.notFound('Payment not found');
    await repo.deletePayment(id);
    activity.record({ userId: actor.id, action: 'payment.deleted', entityType: 'payment', entityId: id, req });
    return { success: true };
  },

  // ===== Expenses =====
  async listExpenses(query) {
    const { page, limit, skip, take } = getPagination(query);
    const where = {};
    if (query.scope) where.scope = query.scope;
    if (query.projectId) where.projectId = query.projectId;
    if (query.category) where.category = query.category;
    if (query.account) where.account = query.account;
    const d = dateWhere(query);
    if (d) where.date = d;
    const { rows, total } = await repo.listExpenses({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async createExpense(payload, actor, req) {
    const config = await loadConfig();
    assertIn(payload.category, config.categories, 'expense category');
    assertIn(payload.method, config.methods, 'payment method');
    assertIn(payload.account, config.accounts.map((a) => a.key), 'account');
    if (payload.scope === 'PROJECT') await validateProject(payload.projectId);

    const expense = await repo.createExpense({
      scope: payload.scope,
      projectId: payload.scope === 'PROJECT' ? payload.projectId : null,
      category: payload.category,
      amount: payload.amount,
      date: payload.date,
      method: payload.method,
      account: payload.account,
      expenseBy: payload.expenseBy,
      notes: payload.notes,
      createdById: actor.id,
    });
    activity.record({ userId: actor.id, action: 'expense.created', entityType: 'expense', entityId: expense.id, req });
    return expense;
  },

  async updateExpense(id, payload, actor, req) {
    const existing = await repo.findExpense(id);
    if (!existing) throw AppError.notFound('Expense not found');
    const config = await loadConfig();
    if (payload.category) assertIn(payload.category, config.categories, 'expense category');
    if (payload.method) assertIn(payload.method, config.methods, 'payment method');
    if (payload.account) assertIn(payload.account, config.accounts.map((a) => a.key), 'account');

    const expense = await repo.updateExpense(id, payload);
    activity.record({ userId: actor.id, action: 'expense.updated', entityType: 'expense', entityId: id, req });
    return expense;
  },

  async deleteExpense(id, actor, req) {
    const existing = await repo.findExpense(id);
    if (!existing) throw AppError.notFound('Expense not found');
    await repo.deleteExpense(id);
    activity.record({ userId: actor.id, action: 'expense.deleted', entityType: 'expense', entityId: id, req });
    return { success: true };
  },

  // ===== Derived views =====

  // Per-account balances derived from the ledger + configured opening balances.
  async accounts() {
    const config = await loadConfig();
    const [payAgg, expAgg] = await Promise.all([repo.paymentsByAccount(), repo.expensesByAccount()]);
    const inByAccount = new Map(payAgg.map((r) => [r.account, D(r._sum.amount)]));
    const outByAccount = new Map(expAgg.map((r) => [r.account, D(r._sum.amount)]));

    const byType = {};
    const accounts = config.accounts.map((a) => {
      const received = inByAccount.get(a.key) || D(0);
      const spent = outByAccount.get(a.key) || D(0);
      const balance = D(a.openingBalance).plus(received).minus(spent);
      const type = a.type || 'other';
      byType[type] = D(byType[type]).plus(balance).toFixed(2);
      return {
        key: a.key,
        name: a.name,
        type,
        openingBalance: money(a.openingBalance),
        received: money(received),
        spent: money(spent),
        balance: money(balance),
      };
    });
    return { accounts, byType };
  },

  // Full project finance detail.
  async projectSummary(projectId) {
    const project = await repo.findProject(projectId);
    if (!project) throw AppError.notFound('Project not found');

    const [receivedAgg, projectExpAgg, payments, phaseGroups, phases] = await Promise.all([
      repo.sumPayments({ projectId }),
      repo.sumExpenses({ scope: 'PROJECT', projectId }),
      repo.listPayments({ where: { projectId }, skip: 0, take: 500 }),
      repo.paymentsByPhase(projectId),
      repo.projectPhases(projectId),
    ]);

    const total = D(project.projectAmount);
    const received = D(receivedAgg._sum.amount);
    const phaseNames = new Map(phases.map((p) => [p.id, p.name]));
    const phaseWise = phaseGroups.map((g) => ({
      phaseId: g.phaseId,
      phaseName: g.phaseId ? phaseNames.get(g.phaseId) || 'Unknown phase' : 'Unassigned',
      received: money(g._sum.amount),
    }));

    return {
      projectId,
      referenceNumber: project.referenceNumber,
      totalAmount: money(total),
      advanceAmount: money(project.advanceAmount),
      receivedAmount: money(received),
      balanceAmount: money(total.minus(received)),
      projectExpenses: money(projectExpAgg._sum.amount),
      phaseWise,
      payments: payments.rows,
    };
  },

  // Company-wide finance overview.
  async overview(query) {
    const d = dateWhere(query);
    const txWhere = d ? { date: d } : {};

    const [received, companyExp, projectExp, byCategory, accounts] = await Promise.all([
      repo.sumPayments(txWhere),
      repo.sumExpenses({ ...txWhere, scope: 'COMPANY' }),
      repo.sumExpenses({ ...txWhere, scope: 'PROJECT' }),
      repo.expensesByCategory(txWhere),
      this.accounts(),
    ]);

    const totalReceived = D(received._sum.amount);
    const companyExpenses = D(companyExp._sum.amount);
    const projectExpenses = D(projectExp._sum.amount);
    const totalExpenses = companyExpenses.plus(projectExpenses);

    return {
      totalReceived: money(totalReceived),
      companyExpenses: money(companyExpenses),
      projectExpenses: money(projectExpenses),
      totalExpenses: money(totalExpenses),
      profit: money(totalReceived.minus(totalExpenses)),
      expenseByCategory: byCategory
        .map((c) => ({ category: c.category, amount: money(c._sum.amount) }))
        .sort((a, b) => Number(b.amount) - Number(a.amount)),
      accounts: accounts.accounts,
      byType: accounts.byType,
    };
  },
};

module.exports = financeService;
