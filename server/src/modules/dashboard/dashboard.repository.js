'use strict';

const prisma = require('../../config/prisma');

const dashboardRepository = {
  totalProjects() {
    return prisma.project.count({ where: { deletedAt: null } });
  },
  sumProjectAmount() {
    return prisma.project.aggregate({ where: { deletedAt: null }, _sum: { projectAmount: true } });
  },
  projectStatusCounts() {
    return prisma.project.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } });
  },
  totalUsers() {
    return prisma.user.count({ where: { deletedAt: null } });
  },

  recentProjects(take = 5) {
    return prisma.project.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, referenceNumber: true, name: true, clientName: true, status: true, createdAt: true },
    });
  },
  recentActivities(take = 10) {
    return prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { id: true, name: true } } },
    });
  },
  upcomingDeadlines(take = 10) {
    return prisma.projectPhase.findMany({
      where: { deadline: { gte: new Date() }, status: { not: 'completed' }, project: { deletedAt: null } },
      orderBy: { deadline: 'asc' },
      take,
      include: { project: { select: { id: true, referenceNumber: true, name: true } } },
    });
  },

  // Time-series sums grouped by a DATE_FORMAT bucket (MySQL). The format string
  // is bound as a parameter, so this stays injection-safe.
  revenueSeries(fromDate, fmt) {
    return prisma.$queryRaw`SELECT DATE_FORMAT(date, ${fmt}) period, SUM(amount) total
      FROM payments WHERE date >= ${fromDate} GROUP BY period ORDER BY period`;
  },
  expenseSeries(fromDate, fmt) {
    return prisma.$queryRaw`SELECT DATE_FORMAT(date, ${fmt}) period, SUM(amount) total
      FROM expenses WHERE date >= ${fromDate} GROUP BY period ORDER BY period`;
  },
};

module.exports = dashboardRepository;
