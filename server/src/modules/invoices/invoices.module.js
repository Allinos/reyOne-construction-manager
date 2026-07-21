'use strict';

const { registerRoutes } = require('./invoices.routes');

module.exports = {
  key: 'invoices',
  name: 'Invoices & Quotations',
  description: 'Quotations and invoices with professional PDF output',
  basePath: '/invoices',
  isCore: false, // feature module — can be disabled per client
  dependsOn: ['auth'],
  sortOrder: 13,
  registerRoutes,
};
