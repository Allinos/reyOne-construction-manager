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
    await prisma.module.upsert({
      where: { key: m.key },
      // Do not override enabled on update — an admin's toggles must survive reseeds.
      update: { name: m.name, description: m.description, isCore: m.isCore, sortOrder: m.sortOrder },
      create: m,
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
