'use strict';

const { registerRoutes } = require('./vendors.routes');

module.exports = {
  key: 'vendors',
  name: 'Vendors',
  description: 'Vendor directory & ledgers',
  basePath: '/vendors',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 15,
  registerRoutes,
};
