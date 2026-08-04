'use strict';

/**
 * Canonical permission catalog. Keys are "<module>.<action>". The seed script
 * writes these into the permissions table and wires them to default roles.
 * Adding a permission here + reseeding is all it takes to introduce one.
 */
const PERMISSIONS = [
  // Users
  { key: 'users.read', module: 'users', action: 'read', description: 'View users' },
  { key: 'users.create', module: 'users', action: 'create', description: 'Create users' },
  { key: 'users.update', module: 'users', action: 'update', description: 'Edit users' },
  { key: 'users.delete', module: 'users', action: 'delete', description: 'Delete users' },

  // Roles & permissions
  { key: 'roles.read', module: 'roles', action: 'read', description: 'View roles' },
  { key: 'roles.create', module: 'roles', action: 'create', description: 'Create roles' },
  { key: 'roles.update', module: 'roles', action: 'update', description: 'Edit roles & assign permissions' },
  { key: 'roles.delete', module: 'roles', action: 'delete', description: 'Delete roles' },

  // Settings (company, categories, phases, payment methods, ...)
  { key: 'settings.read', module: 'settings', action: 'read', description: 'View settings' },
  { key: 'settings.update', module: 'settings', action: 'update', description: 'Edit settings' },

  // Module manager
  { key: 'modules.read', module: 'modules', action: 'read', description: 'View modules' },
  { key: 'modules.update', module: 'modules', action: 'update', description: 'Enable/disable modules' },

  // Activity logs
  { key: 'activity.read', module: 'activity', action: 'read', description: 'View activity logs' },

  // Dashboard
  { key: 'dashboard.read', module: 'dashboard', action: 'read', description: 'View dashboard' },

  // Projects
  { key: 'projects.read', module: 'projects', action: 'read', description: 'View projects' },
  { key: 'projects.create', module: 'projects', action: 'create', description: 'Create projects' },
  { key: 'projects.update', module: 'projects', action: 'update', description: 'Edit projects' },
  { key: 'projects.delete', module: 'projects', action: 'delete', description: 'Delete projects' },

  // Finance
  { key: 'finance.read', module: 'finance', action: 'read', description: 'View finance' },
  { key: 'finance.create', module: 'finance', action: 'create', description: 'Record payments/expenses' },
  { key: 'finance.update', module: 'finance', action: 'update', description: 'Edit finance records' },
  { key: 'finance.delete', module: 'finance', action: 'delete', description: 'Delete finance records' },

  // Invoices & Quotations
  { key: 'invoices.read', module: 'invoices', action: 'read', description: 'View invoices & quotations' },
  { key: 'invoices.create', module: 'invoices', action: 'create', description: 'Create invoices & quotations' },
  { key: 'invoices.update', module: 'invoices', action: 'update', description: 'Edit invoices, quotations & config' },
  { key: 'invoices.delete', module: 'invoices', action: 'delete', description: 'Delete invoices & quotations' },

  // Clients
  { key: 'clients.read', module: 'clients', action: 'read', description: 'View clients' },
  { key: 'clients.update', module: 'clients', action: 'update', description: 'Edit client details' },

  // Vendors
  { key: 'vendors.read', module: 'vendors', action: 'read', description: 'View vendors & ledgers' },
  { key: 'vendors.create', module: 'vendors', action: 'create', description: 'Create vendors' },
  { key: 'vendors.update', module: 'vendors', action: 'update', description: 'Edit vendors' },
  { key: 'vendors.delete', module: 'vendors', action: 'delete', description: 'Delete vendors' },

  // Workforce
  { key: 'workforce.read', module: 'workforce', action: 'read', description: 'View workforce' },
  { key: 'workforce.create', module: 'workforce', action: 'create', description: 'Create workforce members' },
  { key: 'workforce.update', module: 'workforce', action: 'update', description: 'Edit workforce members' },
  { key: 'workforce.delete', module: 'workforce', action: 'delete', description: 'Delete workforce members' },

  // Project Requirements & Details
  { key: 'requirements.read', module: 'requirements', action: 'read', description: 'View project requirements' },
  { key: 'requirements.update', module: 'requirements', action: 'update', description: 'Edit project requirements & photos' },
];

const WILDCARD = '*';

/**
 * Seven default roles. `permissions: '*'` = wildcard (Owner). Others list the
 * permission keys they receive. Roles are seeded as system roles (undeletable)
 * but more roles can be created at runtime.
 */
const DEFAULT_ROLES = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Full access to everything',
    permissions: WILDCARD,
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Administrative access to all modules',
    permissions: PERMISSIONS.map((p) => p.key),
  },
  {
    key: 'project_manager',
    name: 'Project Manager',
    description: 'Manages projects and their teams',
    permissions: [
      'dashboard.read',
      'projects.read', 'projects.create', 'projects.update',
      'finance.read',
      'clients.read',
      'vendors.read',
      'workforce.read', 'workforce.create', 'workforce.update',
      'requirements.read', 'requirements.update',
      'users.read',
      'activity.read',
    ],
  },
  {
    key: 'site_engineer',
    name: 'Site Engineer',
    description: 'Works on assigned projects and phases',
    permissions: ['dashboard.read', 'projects.read', 'projects.update', 'requirements.read', 'requirements.update', 'workforce.read'],
  },
  {
    key: 'accountant',
    name: 'Accountant',
    description: 'Manages project and company finance',
    permissions: [
      'dashboard.read',
      'finance.read', 'finance.create', 'finance.update', 'finance.delete',
      'projects.read',
      'invoices.read', 'invoices.create', 'invoices.update', 'invoices.delete',
      'clients.read', 'clients.update',
      'vendors.read', 'vendors.create', 'vendors.update', 'vendors.delete',
      'workforce.read', 'workforce.create', 'workforce.update', 'workforce.delete',
      'requirements.read', 'requirements.update',
      'activity.read',
    ],
  },
  {
    key: 'store_manager',
    name: 'Store Manager',
    description: 'Manages stores/inventory (module added later)',
    permissions: ['dashboard.read', 'projects.read'],
  },
  {
    key: 'employee',
    name: 'Employee',
    description: 'Basic access',
    permissions: ['dashboard.read', 'projects.read'],
  },
];

module.exports = { PERMISSIONS, DEFAULT_ROLES, WILDCARD };
