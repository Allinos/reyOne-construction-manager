'use strict';

const { registerRoutes } = require('./finance.routes');

module.exports = {
  key: 'finance',
  name: 'Finance',
  description: 'Project & company finance — payments, expenses, and balances',
  basePath: '/finance',
  isCore: false, // feature module — can be disabled per client
  dependsOn: ['auth', 'projects'],
  sortOrder: 12,
  registerRoutes,
};
