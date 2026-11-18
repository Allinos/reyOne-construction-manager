'use strict';

const { registerRoutes } = require('./payroll.routes');

module.exports = {
  key: 'payroll',
  name: 'Salary & Payroll',
  description: 'Salaries, payments, advances & pending dues',
  basePath: '/payroll',
  isCore: false,
  dependsOn: ['auth'],
  sortOrder: 26,
  registerRoutes,
};
