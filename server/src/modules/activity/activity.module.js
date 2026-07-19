'use strict';

const { registerRoutes } = require('./activity.routes');

module.exports = {
  key: 'activity',
  name: 'Activity Logs',
  description: 'Audit trail of key actions',
  basePath: '/activity',
  isCore: true,
  dependsOn: ['auth'],
  sortOrder: 6,
  registerRoutes,
};
