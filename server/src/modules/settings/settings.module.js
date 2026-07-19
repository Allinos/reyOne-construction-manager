'use strict';

const { registerRoutes } = require('./settings.routes');

module.exports = {
  key: 'settings',
  name: 'Settings',
  description: 'Company profile, configuration, lookups, and form customization',
  basePath: '/settings',
  isCore: true,
  dependsOn: ['auth'],
  sortOrder: 4,
  registerRoutes,
};
