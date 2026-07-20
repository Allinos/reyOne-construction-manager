'use strict';

const prisma = require('../../config/prisma');

const roleSelect = { select: { id: true, key: true, name: true } };

const publicSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  designation: true,
  salary: true,
  status: true,
  lastLoginAt: true,
  roleId: true,
  role: roleSelect,
  createdAt: true,
  updatedAt: true,
};

const usersRepository = {
  async findMany({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: publicSelect,
      }),
      prisma.user.count({ where }),
    ]);
    return { rows, total };
  },

  findById(id) {
    return prisma.user.findFirst({ where: { id, deletedAt: null }, select: publicSelect });
  },

  findRawById(id) {
    return prisma.user.findFirst({ where: { id, deletedAt: null } });
  },

  create(data) {
    return prisma.user.create({ data, select: publicSelect });
  },

  update(id, data) {
    return prisma.user.update({ where: { id }, data, select: publicSelect });
  },

  softDelete(id) {
    return prisma.user.update({
      where: { id },
      // Free the unique email so it can be reused after deletion.
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  },

  updatePassword(id, passwordHash) {
    return prisma.user.update({ where: { id }, data: { passwordHash } });
  },

  countByRole(roleId) {
    return prisma.user.count({ where: { roleId, deletedAt: null } });
  },
};

module.exports = { usersRepository, publicSelect };
