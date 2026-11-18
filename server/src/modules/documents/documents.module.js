'use strict';

const { registerRoutes } = require('./documents.routes');

module.exports = {
  key: 'documents',
  name: 'Documents',
  description: 'Document template library & generator',
  basePath: '/documents',
  isCore: false, // feature module — can be disabled per client
  dependsOn: ['auth'],
  sortOrder: 13,
  registerRoutes,
};
