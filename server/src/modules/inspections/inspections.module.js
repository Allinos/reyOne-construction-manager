'use strict';

const { registerRoutes } = require('./inspections.routes');

module.exports = {
  key: 'inspections',
  name: 'Site Inspection',
  description: 'Checklists, photos, issues & corrective actions',
  basePath: '/inspections',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 28,
  registerRoutes,
};
