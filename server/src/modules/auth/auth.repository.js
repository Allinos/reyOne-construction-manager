'use strict';

const prisma = require('../../config/prisma');

const roleInclude = {
  role: { include: { permissions: { include: { permission: true } } } },
};

const authRepository = {
  findUserByEmail(email) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: roleInclude,
    });
  },

  findUserById(id) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: roleInclude,
    });
  },

  createRefreshToken(data) {
    return prisma.refreshToken.create({ data });
  },

  findRefreshToken(tokenHash) {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  revokeRefreshToken(tokenHash) {
    return prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId) {
    return prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  updatePassword(userId, passwordHash) {
    return prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  },

  touchLastLogin(userId) {
    return prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  },
};

module.exports = authRepository;
