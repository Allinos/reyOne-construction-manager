'use strict';

const { registerRoutes } = require('./materials.routes');

module.exports = {
  key: 'materials',
  name: 'Materials & Inventory',
  description: 'Requests, approvals, procurement, stock & consumption',
  basePath: '/materials',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 27,
  registerRoutes,
};
