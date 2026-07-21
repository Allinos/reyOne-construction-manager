'use strict';

const prisma = require('../../config/prisma');

const invoicesRepository = {
  async list({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.billingDocument.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.billingDocument.count({ where }),
    ]);
    return { rows, total };
  },
  findById(id) {
    return prisma.billingDocument.findFirst({ where: { id, deletedAt: null } });
  },
  findByNumber(type, number) {
    return prisma.billingDocument.findFirst({ where: { type, number } });
  },
  create(data) {
    return prisma.billingDocument.create({ data });
  },
  update(id, data) {
    return prisma.billingDocument.update({ where: { id }, data });
  },
  softDelete(id) {
    return prisma.billingDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  },
  // Counts all (incl. soft-deleted) so numbers are never reused.
  countByType(type) {
    return prisma.billingDocument.count({ where: { type } });
  },

  // --- invoice config & prefixes (stored in settings group "invoices") ---
  getSetting(key) {
    return prisma.setting.findUnique({ where: { group_key: { group: 'invoices', key } } });
  },
  upsertSetting(key, value) {
    return prisma.setting.upsert({
      where: { group_key: { group: 'invoices', key } },
      update: { value },
      create: { group: 'invoices', key, value },
    });
  },
};

module.exports = invoicesRepository;
