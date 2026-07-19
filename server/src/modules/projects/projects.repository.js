'use strict';

const prisma = require('../../config/prisma');

const listSelect = {
  id: true,
  referenceNumber: true,
  name: true,
  clientName: true,
  category: true,
  status: true,
  agreementDate: true,
  projectAmount: true,
  advanceAmount: true,
  createdAt: true,
};

// Full detail include: phases -> tasks + assignees, ordered.
const detailInclude = {
  phases: {
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: {
      assignees: true,
      tasks: {
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        include: { assignees: true },
      },
    },
  },
};

const projectsRepository = {
  async list({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.project.findMany({ where, skip, take, orderBy: { createdAt: 'desc' }, select: listSelect }),
      prisma.project.count({ where }),
    ]);
    return { rows, total };
  },

  // Count includes soft-deleted rows so reference numbers are never reused.
  countAll() {
    return prisma.project.count();
  },

  findByReference(referenceNumber) {
    return prisma.project.findUnique({ where: { referenceNumber } });
  },

  findById(id) {
    return prisma.project.findFirst({ where: { id, deletedAt: null }, include: detailInclude });
  },

  findRawById(id) {
    return prisma.project.findFirst({ where: { id, deletedAt: null } });
  },

  create(data) {
    return prisma.project.create({ data, include: detailInclude });
  },

  update(id, data) {
    return prisma.project.update({ where: { id }, data, include: detailInclude });
  },

  softDelete(id) {
    return prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  // --- Phases ---
  createPhase(data) {
    return prisma.projectPhase.create({ data });
  },
  findPhase(id) {
    return prisma.projectPhase.findUnique({ where: { id } });
  },
  updatePhase(id, data) {
    return prisma.projectPhase.update({ where: { id }, data });
  },
  deletePhase(id) {
    return prisma.projectPhase.delete({ where: { id } });
  },
  async setPhaseAssignees(phaseId, userIds) {
    await prisma.$transaction([
      prisma.phaseAssignee.deleteMany({ where: { phaseId } }),
      prisma.phaseAssignee.createMany({
        data: userIds.map((userId) => ({ phaseId, userId })),
        skipDuplicates: true,
      }),
    ]);
  },

  // --- Tasks ---
  createTask(data) {
    return prisma.phaseTask.create({ data });
  },
  findTask(id) {
    return prisma.phaseTask.findUnique({ where: { id } });
  },
  updateTask(id, data) {
    return prisma.phaseTask.update({ where: { id }, data });
  },
  deleteTask(id) {
    return prisma.phaseTask.delete({ where: { id } });
  },
  async setTaskAssignees(taskId, userIds) {
    await prisma.$transaction([
      prisma.taskAssignee.deleteMany({ where: { taskId } }),
      prisma.taskAssignee.createMany({
        data: userIds.map((userId) => ({ taskId, userId })),
        skipDuplicates: true,
      }),
    ]);
  },

  // Resolves assignee user ids to lightweight user objects for output.
  activeUsersByIds(ids) {
    return prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, email: true, designation: true },
    });
  },
  countActiveUsersByIds(ids) {
    return prisma.user.count({ where: { id: { in: ids }, deletedAt: null } });
  },
};

module.exports = projectsRepository;
