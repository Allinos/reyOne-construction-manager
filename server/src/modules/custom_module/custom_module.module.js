'use strict';

const { registerRoutes } = require('./custom_module.routes');

module.exports = {
  key: 'custom_module',
  name: 'Custom Module',
  description: 'Fully customizable form, list & analytics',
  basePath: '/custom-module',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 22,
  registerRoutes,
};
