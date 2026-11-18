'use strict';

const { registerRoutes } = require('./attendance.routes');

module.exports = {
  key: 'attendance',
  name: 'Attendance',
  description: 'Daily attendance for employees & labour',
  basePath: '/attendance',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 25,
  registerRoutes,
};
