'use strict';

const { registerRoutes } = require('./dashboard.routes');

module.exports = {
  key: 'dashboard',
  name: 'Dashboard',
  description: 'Company overview — stats, charts, and recent activity',
  basePath: '/dashboard',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 10,
  registerRoutes,
};
