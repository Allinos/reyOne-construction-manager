'use strict';

const repo = require('./dashboard.repository');
const financeService = require('../finance/finance.service');

// --- chart helpers -------------------------------------------------------

function monthLabels(count) {
  const labels = [];
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - (count - 1));
  for (let i = 0; i < count; i += 1) {
    labels.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return labels;
}

function yearLabels(count) {
  const year = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => String(year - (count - 1) + i));
}

// Aligns raw {period,total} rows to a fixed label list, filling gaps with 0.
function alignSeries(labels, rows) {
  const map = new Map(rows.map((r) => [String(r.period), Number(r.total || 0)]));
  return labels.map((l) => Number((map.get(l) || 0).toFixed(2)));
}

// --- service -------------------------------------------------------------

const dashboardService = {
  async summary() {
    const [totalProjects, statusCounts, totalUsers, finance] = await Promise.all([
      repo.totalProjects(),
      repo.projectStatusCounts(),
      repo.totalUsers(),
      financeService.overview({}),
    ]);

    const projectStatus = {};
    for (const row of statusCounts) projectStatus[row.status] = row._count._all;

    return {
      stats: {
        totalProjects,
        runningProjects: projectStatus.in_progress || 0,
        completedProjects: projectStatus.completed || 0,
        pendingProjects: projectStatus.pending || 0,
        onHoldProjects: projectStatus.on_hold || 0,
        totalUsers,
        totalRevenue: finance.totalReceived,
        totalExpenses: finance.totalExpenses,
        totalProfit: finance.profit,
      },
      projectStatus,
      finance: { byType: finance.byType, accounts: finance.accounts },
      expenseByCategory: finance.expenseByCategory,
    };
  },

  async charts(query) {
    const period = query.period === 'yearly' ? 'yearly' : 'monthly';
    const isMonthly = period === 'monthly';
    const count = isMonthly ? 12 : 5;
    const labels = isMonthly ? monthLabels(count) : yearLabels(count);
    const fmt = isMonthly ? '%Y-%m' : '%Y';

    const from = new Date(labels[0] + (isMonthly ? '-01' : '-01-01') + 'T00:00:00');
    const [revenueRows, expenseRows] = await Promise.all([
      repo.revenueSeries(from, fmt),
      repo.expenseSeries(from, fmt),
    ]);

    return {
      period,
      labels,
      revenue: alignSeries(labels, revenueRows),
      expenses: alignSeries(labels, expenseRows),
    };
  },

  async activity() {
    const [recentProjects, recentActivities, upcomingDeadlines] = await Promise.all([
      repo.recentProjects(5),
      repo.recentActivities(10),
      repo.upcomingDeadlines(10),
    ]);
    return { recentProjects, recentActivities, upcomingDeadlines };
  },
};

module.exports = dashboardService;
