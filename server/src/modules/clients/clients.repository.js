'use strict';

const prisma = require('../../config/prisma');

const clientsRepository = {
  // Distinct client identities embedded in projects (to backfill the directory).
  distinctProjectClients() {
    return prisma.project.findMany({
      where: { deletedAt: null },
      distinct: ['clientName'],
      select: { clientName: true, clientPhone: true, clientEmail: true, clientAddress: true },
    });
  },
  ensureClients(rows) {
    return prisma.client.createMany({
      data: rows.map((r) => ({
        name: r.clientName,
        phone: r.clientPhone || null,
        email: r.clientEmail || null,
        address: r.clientAddress || null,
      })),
      skipDuplicates: true,
    });
  },

  async list({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.client.findMany({ where, skip, take, orderBy: { name: 'asc' } }),
      prisma.client.count({ where }),
    ]);
    return { rows, total };
  },
  findById(id) {
    return prisma.client.findFirst({ where: { id, deletedAt: null } });
  },
  update(id, data) {
    return prisma.client.update({ where: { id }, data });
  },
  softDelete(id) {
    return prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  statsByClient() {
    return prisma.project.groupBy({ by: ['clientName', 'status'], where: { deletedAt: null }, _count: { _all: true } });
  },
  clientProjects(name) {
    return prisma.project.findMany({
      where: { clientName: name, deletedAt: null },
      select: { id: true, referenceNumber: true, name: true, status: true, projectAmount: true, agreementDate: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};

module.exports = clientsRepository;
