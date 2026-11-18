'use strict';

const { registerRoutes } = require('./queries.routes');

module.exports = {
  key: 'queries',
  name: 'Queries',
  description: 'Project/site queries with assignment & replies',
  basePath: '/queries',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 29,
  registerRoutes,
};
