'use strict';

const prisma = require('../../config/prisma');

const GROUP = 'custom_module';

const customModuleRepository = {
  // --- Records ---
  async listRecords({ skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.customRecord.findMany({ where: { deletedAt: null }, skip, take, orderBy: { id: 'desc' } }),
      prisma.customRecord.count({ where: { deletedAt: null } }),
    ]);
    return { rows, total };
  },
  allRecords() {
    return prisma.customRecord.findMany({ where: { deletedAt: null }, orderBy: { id: 'desc' } });
  },
  findRecord(id) {
    return prisma.customRecord.findFirst({ where: { id, deletedAt: null } });
  },
  createRecord(values) {
    return prisma.customRecord.create({ data: { values } });
  },
  updateRecord(id, values) {
    return prisma.customRecord.update({ where: { id }, data: { values } });
  },
  softDeleteRecord(id) {
    return prisma.customRecord.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  // --- Config (stored in settings) ---
  async getSetting(key) {
    const row = await prisma.setting.findUnique({ where: { group_key: { group: GROUP, key } } });
    return row ? row.value : undefined;
  },
  setSetting(key, value) {
    return prisma.setting.upsert({
      where: { group_key: { group: GROUP, key } },
      update: { value },
      create: { group: GROUP, key, value },
    });
  },
};

module.exports = customModuleRepository;
