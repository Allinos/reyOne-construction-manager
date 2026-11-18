'use strict';

const prisma = require('../../config/prisma');

const listSelect = {
  id: true,
  templateKey: true,
  title: true,
  category: true,
  projectId: true,
  clientId: true,
  vendorId: true,
  reference: true,
  status: true,
  createdAt: true,
};

const documentsRepository = {
  async list({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.generatedDocument.findMany({ where, skip, take, orderBy: { id: 'desc' }, select: listSelect }),
      prisma.generatedDocument.count({ where }),
    ]);
    return { rows, total };
  },
  findById(id) {
    return prisma.generatedDocument.findFirst({ where: { id, deletedAt: null } });
  },
  create(data) {
    return prisma.generatedDocument.create({ data });
  },
  update(id, data) {
    return prisma.generatedDocument.update({ where: { id }, data });
  },
  softDelete(id) {
    return prisma.generatedDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  company() {
    return prisma.company.findFirst();
  },
  async branding() {
    const row = await prisma.setting.findUnique({ where: { group_key: { group: 'documents', key: 'branding' } } });
    return row ? row.value : {};
  },
};

module.exports = documentsRepository;
