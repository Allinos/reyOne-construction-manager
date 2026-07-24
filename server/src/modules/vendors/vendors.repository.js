'use strict';

const prisma = require('../../config/prisma');

const vendorsRepository = {
  async list({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.vendor.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.vendor.count({ where }),
    ]);
    return { rows, total };
  },
  findById(id) {
    return prisma.vendor.findFirst({ where: { id, deletedAt: null } });
  },
  create(data) {
    return prisma.vendor.create({ data });
  },
  update(id, data) {
    return prisma.vendor.update({ where: { id }, data });
  },
  softDelete(id) {
    return prisma.vendor.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  // --- ledger data ---
  vendorExpenses(vendorId) {
    return prisma.expense.findMany({ where: { vendorId }, orderBy: { date: 'desc' }, take: 500 });
  },
  expenseSums(vendorId) {
    return prisma.expense.aggregate({ where: { vendorId }, _sum: { amount: true, amountPaid: true } });
  },
  async projectsByIds(ids) {
    if (!ids.length) return [];
    return prisma.project.findMany({
      where: { id: { in: ids } },
      select: { id: true, referenceNumber: true, name: true },
    });
  },
};

module.exports = vendorsRepository;
