'use strict';

const { registerRoutes } = require('./notifications.routes');

module.exports = {
  key: 'notifications',
  name: 'Notifications',
  description: 'In-app notifications',
  basePath: '/notifications',
  isCore: true,
  dependsOn: ['auth'],
  sortOrder: 7,
  registerRoutes,
};
