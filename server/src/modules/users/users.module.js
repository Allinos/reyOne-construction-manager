'use strict';

const { registerRoutes } = require('./users.routes');

module.exports = {
  key: 'users',
  name: 'Users',
  description: 'Employee / user management',
  basePath: '/users',
  isCore: true,
  dependsOn: ['auth', 'roles'],
  sortOrder: 2,
  registerRoutes,
};
