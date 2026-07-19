'use strict';

const prisma = require('../../config/prisma');

const modulesRepository = {
  findAll() {
    return prisma.module.findMany({ orderBy: { sortOrder: 'asc' } });
  },
  findByKey(key) {
    return prisma.module.findUnique({ where: { key } });
  },
  setEnabled(key, enabled) {
    return prisma.module.update({ where: { key }, data: { enabled } });
  },
  findEnabledDependents(dependentKeys) {
    return prisma.module.findMany({ where: { key: { in: dependentKeys }, enabled: true } });
  },
};

module.exports = modulesRepository;
