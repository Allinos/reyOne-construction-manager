'use strict';

const { registerRoutes } = require('./bootstrap.routes');

module.exports = {
  key: 'bootstrap',
  name: 'Bootstrap',
  description: 'Initial client configuration payload',
  basePath: '/bootstrap',
  isCore: true,
  dependsOn: ['auth'],
  sortOrder: 0,
  registerRoutes,
};
