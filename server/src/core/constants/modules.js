'use strict';

/**
 * Module catalog seeded into the `modules` table so the Module Manager can list
 * and toggle them. Core modules cannot be disabled. Rows may be seeded before
 * their code exists — the registry only mounts a module if its manifest is
 * present, so seeding metadata early is safe.
 */
const MODULE_CATALOG = [
  // Core — always on
  { key: 'auth', name: 'Authentication', isCore: true, enabled: true, sortOrder: 1, description: 'Login & sessions' },
  { key: 'users', name: 'Users', isCore: true, enabled: true, sortOrder: 2, description: 'Employee management' },
  { key: 'roles', name: 'Roles & Permissions', isCore: true, enabled: true, sortOrder: 3, description: 'Access control' },
  { key: 'settings', name: 'Settings', isCore: true, enabled: true, sortOrder: 4, description: 'Company & app configuration' },
  { key: 'modules', name: 'Module Manager', isCore: true, enabled: true, sortOrder: 5, description: 'Enable/disable modules' },
  { key: 'activity', name: 'Activity Logs', isCore: true, enabled: true, sortOrder: 6, description: 'Audit trail' },

  // Feature modules — toggleable
  { key: 'dashboard', name: 'Dashboard', isCore: false, enabled: true, sortOrder: 10, description: 'Company overview' },
  { key: 'projects', name: 'Projects', isCore: false, enabled: true, sortOrder: 11, description: 'Project & phase management' },
  { key: 'finance', name: 'Finance', isCore: false, enabled: true, sortOrder: 12, description: 'Project & company finance' },

  // Future modules — seeded disabled so they appear in the Module Manager
  { key: 'attendance', name: 'Attendance', isCore: false, enabled: false, sortOrder: 20, description: 'Coming soon' },
  { key: 'payroll', name: 'Payroll', isCore: false, enabled: false, sortOrder: 21, description: 'Coming soon' },
  { key: 'inventory', name: 'Inventory', isCore: false, enabled: false, sortOrder: 22, description: 'Coming soon' },
];

module.exports = { MODULE_CATALOG };
