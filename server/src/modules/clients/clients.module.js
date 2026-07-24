'use strict';

const { registerRoutes } = require('./clients.routes');

module.exports = {
  key: 'clients',
  name: 'Clients',
  description: 'Client directory & profiles',
  basePath: '/clients',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 14,
  registerRoutes,
};
