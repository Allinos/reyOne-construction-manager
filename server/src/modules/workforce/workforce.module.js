'use strict';

const { registerRoutes } = require('./workforce.routes');

module.exports = {
  key: 'workforce',
  name: 'Workforce',
  description: 'Contractors, labour, technicians & other workforce',
  basePath: '/workforce',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 16,
  registerRoutes,
};
