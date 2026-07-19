'use strict';

const prisma = require('../../config/prisma');

const withPermissions = { permissions: { include: { permission: true } } };

const rolesRepository = {
  findMany() {
    return prisma.role.findMany({ orderBy: { id: 'asc' }, include: withPermissions });
  },

  findById(id) {
    return prisma.role.findUnique({ where: { id }, include: withPermissions });
  },

  findByKey(key) {
    return prisma.role.findUnique({ where: { key } });
  },

  create(data) {
    return prisma.role.create({ data });
  },

  updateFields(id, data) {
    return prisma.role.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.role.delete({ where: { id } });
  },

  countUsers(roleId) {
    return prisma.user.count({ where: { roleId, deletedAt: null } });
  },

  listPermissions() {
    return prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { action: 'asc' }] });
  },

  findPermissionsByKeys(keys) {
    return prisma.permission.findMany({ where: { key: { in: keys } } });
  },

  // Replace a role's permission set atomically.
  async setPermissions(roleId, permissionIds) {
    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      }),
    ]);
  },
};

module.exports = rolesRepository;
