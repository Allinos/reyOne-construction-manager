'use strict';

const { registerRoutes } = require('./projects.routes');

module.exports = {
  key: 'projects',
  name: 'Projects',
  description: 'Projects, configurable phases, and tasks',
  basePath: '/projects',
  isCore: false, // feature module — can be disabled per client
  dependsOn: ['auth', 'users'],
  sortOrder: 11,
  registerRoutes,
};
