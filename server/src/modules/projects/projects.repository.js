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
  startDate: true,
  endDate: true,
  projectAmount: true,
  advanceAmount: true,
  progress: true,
  progressMode: true,
  createdAt: true,
};

// Full detail include: project assignees + phases -> tasks + assignees, ordered,
// plus the approval/request thread (newest first).
const detailInclude = {
  assignees: true,
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
  approvals: {
    orderBy: [{ id: 'desc' }],
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

  // Distinct existing clients (one row per client name) for the picker.
  distinctClients() {
    return prisma.project.findMany({
      where: { deletedAt: null },
      distinct: ['clientName'],
      select: { clientName: true, clientPhone: true, clientEmail: true, clientAddress: true },
      orderBy: { clientName: 'asc' },
    });
  },

  latestReference() {
    return prisma.project.findFirst({ orderBy: { id: 'desc' }, select: { referenceNumber: true } });
  },

  countActive() {
    return prisma.project.count({ where: { deletedAt: null } });
  },

  statusCounts() {
    return prisma.project.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  },
  categoryCounts() {
    return prisma.project.groupBy({ by: ['category'], where: { deletedAt: null }, _count: { _all: true } });
  },
  sumAmount() {
    return prisma.project.aggregate({ where: { deletedAt: null }, _sum: { projectAmount: true } });
  },

  // --- analytics extras ---
  avgProgress() {
    return prisma.project.aggregate({ where: { deletedAt: null }, _avg: { progress: true } });
  },
  // Lightweight: one int column, bucketed in JS for the progress distribution.
  progressValues() {
    return prisma.project.findMany({ where: { deletedAt: null }, select: { progress: true, status: true } });
  },
  // Not completed and past the target end date.
  overdueCount() {
    return prisma.project.count({
      where: { deletedAt: null, status: { not: 'completed' }, endDate: { lt: new Date() } },
    });
  },
  // Not completed with a target end date inside the next `days` days.
  upcomingDeadlines(days = 30) {
    const now = new Date();
    const until = new Date(now.getTime() + days * 86400000);
    return prisma.project.findMany({
      where: { deletedAt: null, status: { not: 'completed' }, endDate: { gte: now, lte: until } },
      select: { id: true, referenceNumber: true, name: true, endDate: true, progress: true, status: true },
      orderBy: { endDate: 'asc' },
      take: 10,
    });
  },
  pendingApprovalCount() {
    return prisma.projectApproval.count({ where: { status: 'pending' } });
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

  // --- Project-level assignees ---
  async projectAssigneeUserIds(projectId) {
    const rows = await prisma.projectAssignee.findMany({ where: { projectId }, select: { userId: true } });
    return rows.map((r) => r.userId);
  },
  async setProjectAssignees(projectId, userIds) {
    await prisma.$transaction([
      prisma.projectAssignee.deleteMany({ where: { projectId } }),
      prisma.projectAssignee.createMany({
        data: userIds.map((userId) => ({ projectId, userId })),
        skipDuplicates: true,
      }),
    ]);
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

  // --- progress ---
  // Lean inputs for auto-progress: project status/mode + phase/task statuses.
  progressInputs(id) {
    return prisma.project.findFirst({
      where: { id, deletedAt: null },
      select: {
        status: true,
        progressMode: true,
        phases: { select: { status: true, tasks: { select: { status: true } } } },
      },
    });
  },
  setProgress(id, progress) {
    return prisma.project.update({ where: { id }, data: { progress } });
  },

  // --- approvals / requests ---
  listApprovals(where) {
    return prisma.projectApproval.findMany({ where, orderBy: [{ id: 'desc' }] });
  },
  findApproval(id) {
    return prisma.projectApproval.findUnique({ where: { id } });
  },
  createApproval(data) {
    return prisma.projectApproval.create({ data });
  },
  updateApproval(id, data) {
    return prisma.projectApproval.update({ where: { id }, data });
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
