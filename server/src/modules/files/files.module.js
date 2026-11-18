'use strict';

const { registerRoutes } = require('./files.routes');

module.exports = {
  key: 'files',
  name: 'File Storage',
  description: 'Photos, bills & attachments',
  basePath: '/files',
  isCore: true,
  dependsOn: ['auth'],
  sortOrder: 8,
  registerRoutes,
};
