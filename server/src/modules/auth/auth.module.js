'use strict';

const { registerRoutes } = require('./auth.routes');

/**
 * Auth module manifest. isCore = true means it is always mounted regardless of
 * the modules table (you can never lock yourself out of login).
 */
module.exports = {
  key: 'auth',
  name: 'Authentication',
  description: 'Login, token refresh, and password management',
  basePath: '/auth',
  isCore: true,
  dependsOn: [],
  sortOrder: 1,
  registerRoutes,
};
