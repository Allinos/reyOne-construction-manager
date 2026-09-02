'use strict';

/**
 * Idempotent seed: default company, permissions, roles, modules, a super-admin,
 * and baseline configuration. Safe to run repeatedly (uses upserts).
 */

const prisma = require('../src/config/prisma');
const env = require('../src/config/env');
const { hashPassword } = require('../src/core/utils/password');
const { PERMISSIONS, DEFAULT_ROLES, WILDCARD } = require('../src/core/constants/rbac');
const { MODULE_CATALOG } = require('../src/core/constants/modules');

const WILDCARD_PERMISSION = {
  key: WILDCARD,
  module: 'all',
  action: '*',
  description: 'Full access (Owner)',
};

const DEFAULT_SETTINGS = [
  // Projects
  { group: 'projects', key: 'categories', value: ['Residential', 'Commercial', 'Industrial', 'Renovation'] },
  {
    group: 'projects',
    key: 'statuses',
    value: [
      { key: 'pending', label: 'Pending' },
      { key: 'in_progress', label: 'In Progress' },
      { key: 'on_hold', label: 'On Hold' },
      { key: 'completed', label: 'Completed' },
    ],
  },
  {
    group: 'projects',
    key: 'phase_templates',
    value: ['Planning', 'Foundation', 'Structure', 'Electrical', 'Finishing', 'Interior'],
  },
  { group: 'projects', key: 'reference_prefix', value: 'PRJ-' },
  // Master task list — admins manage these in Settings; projects pick from them.
  { group: 'projects', key: 'task_templates', value: ['Planning', 'Structure', 'Electrical', 'Interior 3D', 'Exterior 3D', 'Finishing'] },

  // Finance
  { group: 'finance', key: 'payment_methods', value: ['Cash', 'Bank', 'Online', 'UPI', 'Cheque'] },
  {
    group: 'finance',
    key: 'expense_categories',
    value: ['Office Rent', 'Electricity', 'Fuel', 'Salary', 'Internet', 'Miscellaneous'],
  },
  // Scope-specific expense categories (editable in Settings).
  {
    group: 'finance',
    key: 'project_expense_categories',
    value: ['Material', 'Labour', 'Equipment Rental', 'Transport', 'Subcontractor', 'Site Utilities'],
  },
  {
    group: 'finance',
    key: 'company_expense_categories',
    value: ['Office Rent', 'Electricity', 'Fuel', 'Salary', 'Internet', 'Marketing', 'Miscellaneous'],
  },
  {
    group: 'finance',
    key: 'accounts',
    value: [
      { key: 'cash', name: 'Cash', type: 'cash' },
      { key: 'bank', name: 'Bank', type: 'bank' },
    ],
  },

  // Users
  { group: 'users', key: 'designations', value: ['Manager', 'Engineer', 'Accountant', 'Supervisor', 'Worker'] },

  // Workforce categories (configurable, each with a display colour)
  {
    group: 'workforce',
    key: 'categories',
    value: [
      { name: 'Contractor', color: '#f97316' },
      { name: 'Labor', color: '#0ea5e9' },
      { name: 'Technician', color: '#8b5cf6' },
      { name: 'Supervisor', color: '#10b981' },
      { name: 'Carpenter', color: '#d97706' },
      { name: 'Electrician', color: '#eab308' },
      { name: 'Plumber', color: '#06b6d4' },
      { name: 'Painter', color: '#ec4899' },
    ],
  },

  // Help centre — three configurable sections (enable/disable + HTML or URL)
  {
    group: 'help',
    key: 'sections',
    value: [
      { key: 'tutorial', title: 'Tutorial', enabled: true, url: '', html: '<h2>Getting Started</h2><p>Welcome! Use the sidebar to navigate modules. Admins can edit this content in Settings → System → Help.</p>' },
      { key: 'support', title: 'Support & Contact', enabled: true, url: '', html: '<h2>Support &amp; Contact</h2><p>Need help? Reach your administrator or update this content in Settings → System → Help.</p>' },
      { key: 'faqs', title: 'FAQs', enabled: true, url: '', html: '<h2>FAQs</h2><p>Add your frequently asked questions in Settings → System → Help.</p>' },
    ],
  },

  // Custom Module — configurable page name + form schema + list visibility
  { group: 'custom_module', key: 'name', value: 'Custom Module' },
  { group: 'custom_module', key: 'fields', value: [] },
  { group: 'custom_module', key: 'list_fields', value: [] },

  // Photo & document categories (configurable, each with a display colour)
  {
    group: 'photos',
    key: 'categories',
    value: [
      { name: 'Project Images', color: '#f97316' },
      { name: 'Client Images', color: '#0ea5e9' },
      { name: 'Documents', color: '#8b5cf6' },
      { name: 'Legal Documents', color: '#ef4444' },
      { name: 'Receipts / Bills', color: '#10b981' },
      { name: 'Other', color: '#64748b' },
    ],
  },

  // Invoices & Quotations
  { group: 'invoices', key: 'quotation_prefix', value: 'QTN-' },
  { group: 'invoices', key: 'invoice_prefix', value: 'INV-' },
  // Per-item GST rate options (%) for the GST invoice template.
  { group: 'invoices', key: 'gst_rates', value: [0, 5, 12, 18, 28] },
  {
    group: 'invoices',
    key: 'config',
    value: {
      companyName: 'reyOne Construction',
      logoUrl: '',
      address: '',
      email: '',
      phone: '',
      website: '',
      gstNumber: '',
      registrationNumber: '',
      bankName: '',
      accountHolder: '',
      accountNumber: '',
      ifsc: '',
      branch: '',
      upiId: '',
      signatureUrl: '',
      terms: 'Payment due within 15 days. Goods once sold will not be taken back.',
      defaultNotes: 'Thank you for your business.',
    },
  },
];

async function seedCompany() {
  const existing = await prisma.company.findFirst();
  if (!existing) {
    await prisma.company.create({ data: { name: 'reyOne Construction' } });
    console.log('  ✓ company created');
  }
}

async function seedPermissions() {
  const all = [...PERMISSIONS, WILDCARD_PERMISSION];
  for (const p of all) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
  console.log(`  ✓ ${all.length} permissions`);
}

async function seedRoles() {
  for (const role of DEFAULT_ROLES) {
    const record = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description, isSystem: true },
      create: { key: role.key, name: role.name, description: role.description, isSystem: true },
    });

    const keys = role.permissions === WILDCARD ? [WILDCARD] : role.permissions;
    const perms = await prisma.permission.findMany({ where: { key: { in: keys } } });

    // Reset this role's permissions to exactly the seeded set.
    await prisma.rolePermission.deleteMany({ where: { roleId: record.id } });
    await prisma.rolePermission.createMany({
      data: perms.map((p) => ({ roleId: record.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }
  console.log(`  ✓ ${DEFAULT_ROLES.length} roles`);
}

async function seedModules() {
  for (const m of MODULE_CATALOG) {
    // Only persist real columns — catalog-only fields like `virtual`/`dependsOn`
    // are used in memory by the modules service and are not stored.
    const { key, name, description, isCore, sortOrder, enabled } = m;
    await prisma.module.upsert({
      where: { key },
      // Do not override enabled on update — an admin's toggles must survive reseeds.
      update: { name, description, isCore, sortOrder },
      create: { key, name, description, isCore, sortOrder, enabled },
    });
  }
  console.log(`  ✓ ${MODULE_CATALOG.length} modules`);
}

async function seedSettings() {
  for (const s of DEFAULT_SETTINGS) {
    await prisma.setting.upsert({
      where: { group_key: { group: s.group, key: s.key } },
      update: {}, // don't clobber admin edits on reseed
      create: s,
    });
  }
  console.log(`  ✓ ${DEFAULT_SETTINGS.length} settings`);
}

async function seedAdmin() {
  const owner = await prisma.role.findUnique({ where: { key: 'owner' } });
  const existing = await prisma.user.findFirst({ where: { email: env.seed.adminEmail } });
  if (existing) {
    console.log('  ✓ admin already exists');
    return;
  }
  await prisma.user.create({
    data: {
      name: env.seed.adminName,
      email: env.seed.adminEmail,
      passwordHash: await hashPassword(env.seed.adminPassword),
      designation: 'Owner',
      status: 'ACTIVE',
      roleId: owner.id,
    },
  });
  console.log(`  ✓ admin created: ${env.seed.adminEmail}`);
}

async function main() {
  console.log('Seeding database...');
  await seedCompany();
  await seedPermissions();
  await seedRoles();
  await seedModules();
  await seedSettings();
  await seedAdmin();
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
