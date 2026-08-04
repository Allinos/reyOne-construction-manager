'use strict';

const { registerRoutes } = require('./requirements.routes');

module.exports = {
  key: 'requirements',
  name: 'Project Requirements',
  description: 'Requirements & details workspace (text, custom forms, spreadsheet, photos)',
  basePath: '/requirements',
  isCore: false,
  dependsOn: ['projects'],
  sortOrder: 17,
  registerRoutes,
};
