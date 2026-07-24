'use strict';

const { Prisma } = require('@prisma/client');
const repo = require('./vendors.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const D = (v) => new Prisma.Decimal(v ?? 0);
const money = (v) => D(v).toFixed(2);

const vendorsService = {
  async list(query) {
    const { page, limit, skip, take } = getPagination(query);
    const where = { deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { contactPerson: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }
    const { rows, total } = await repo.list({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async get(id) {
    const vendor = await repo.findById(id);
    if (!vendor) throw AppError.notFound('Vendor not found');
    return vendor;
  },

  async create(payload, actor, req) {
    const vendor = await repo.create({ ...payload, email: payload.email || null });
    activity.record({ userId: actor.id, action: 'vendor.created', entityType: 'vendor', entityId: vendor.id, req });
    return vendor;
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Vendor not found');
    const data = { ...payload };
    if (data.email === '') data.email = null;
    const vendor = await repo.update(id, data);
    activity.record({ userId: actor.id, action: 'vendor.updated', entityType: 'vendor', entityId: id, req });
    return vendor;
  },

  async remove(id, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Vendor not found');
    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'vendor.deleted', entityType: 'vendor', entityId: id, req });
    return { success: true };
  },

  // Vendor ledger — purchases, payments, outstanding, and expense history.
  async ledger(id) {
    const vendor = await repo.findById(id);
    if (!vendor) throw AppError.notFound('Vendor not found');

    const [expenses, sums] = await Promise.all([repo.vendorExpenses(id), repo.expenseSums(id)]);
    const projectIds = [...new Set(expenses.map((e) => e.projectId).filter(Boolean))];
    const projects = await repo.projectsByIds(projectIds);
    const projMap = new Map(projects.map((p) => [p.id, p]));

    const totalPurchase = D(sums._sum.amount);
    const totalPaid = D(sums._sum.amountPaid);

    return {
      vendor,
      totals: {
        purchase: money(totalPurchase),
        paid: money(totalPaid),
        outstanding: money(totalPurchase.minus(totalPaid)),
      },
      expenses: expenses.map((e) => {
        const remaining = D(e.amount).minus(D(e.amountPaid));
        const proj = e.projectId ? projMap.get(e.projectId) : null;
        return {
          id: e.id,
          date: e.date,
          scope: e.scope,
          projectId: e.projectId,
          projectName: proj ? proj.name : null,
          projectRef: proj ? proj.referenceNumber : null,
          category: e.category,
          amount: money(e.amount),
          amountPaid: money(e.amountPaid),
          remaining: money(remaining),
          paymentStatus: e.paymentStatus,
        };
      }),
    };
  },
};

module.exports = vendorsService;
