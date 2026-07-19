'use strict';

const { registerRoutes } = require('./roles.routes');

module.exports = {
  key: 'roles',
  name: 'Roles & Permissions',
  description: 'Role and permission management',
  basePath: '/roles',
  isCore: true,
  dependsOn: ['auth'],
  sortOrder: 3,
  registerRoutes,
};
