'use strict';

const prisma = require('../../config/prisma');

const workforceRepository = {
  async list({ where, skip, take, orderBy }) {
    const [rows, total] = await Promise.all([
      prisma.workforce.findMany({ where, skip, take, orderBy }),
      prisma.workforce.count({ where }),
    ]);
    return { rows, total };
  },
  findById(id) {
    return prisma.workforce.findFirst({ where: { id, deletedAt: null } });
  },
  create(data) {
    return prisma.workforce.create({ data });
  },
  update(id, data) {
    return prisma.workforce.update({ where: { id }, data });
  },
  softDelete(id) {
    return prisma.workforce.update({ where: { id }, data: { deletedAt: new Date() } });
  },
};

module.exports = workforceRepository;
