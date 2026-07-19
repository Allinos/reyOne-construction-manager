'use strict';

const prisma = require('../../config/prisma');

const settingsRepository = {
  // --- Company (singleton) ---
  getCompany() {
    return prisma.company.findFirst();
  },
  async upsertCompany(data) {
    const existing = await prisma.company.findFirst();
    if (existing) return prisma.company.update({ where: { id: existing.id }, data });
    return prisma.company.create({ data: { name: 'Company', ...data } });
  },

  // --- Generic settings ---
  listSettings() {
    return prisma.setting.findMany({ orderBy: [{ group: 'asc' }, { key: 'asc' }] });
  },
  listByGroup(group) {
    return prisma.setting.findMany({ where: { group }, orderBy: { key: 'asc' } });
  },
  getSetting(group, key) {
    return prisma.setting.findUnique({ where: { group_key: { group, key } } });
  },
  upsertSetting(group, key, value) {
    return prisma.setting.upsert({
      where: { group_key: { group, key } },
      update: { value },
      create: { group, key, value },
    });
  },

  // --- Field definitions (form customizer) ---
  listFieldDefs(entityType) {
    return prisma.fieldDefinition.findMany({
      where: { entityType },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  },
  findFieldDef(id) {
    return prisma.fieldDefinition.findUnique({ where: { id } });
  },
  createFieldDef(data) {
    return prisma.fieldDefinition.create({ data });
  },
  updateFieldDef(id, data) {
    return prisma.fieldDefinition.update({ where: { id }, data });
  },
  deleteFieldDef(id) {
    return prisma.fieldDefinition.delete({ where: { id } });
  },
};

module.exports = settingsRepository;
