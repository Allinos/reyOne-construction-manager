'use strict';

const { registerRoutes } = require('./modules.routes');

module.exports = {
  key: 'modules',
  name: 'Module Manager',
  description: 'Enable or disable feature modules',
  basePath: '/modules',
  isCore: true,
  dependsOn: ['auth'],
  sortOrder: 5,
  registerRoutes,
};
