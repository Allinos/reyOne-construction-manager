'use strict';

const prisma = require('../../config/prisma');
const { usersRepository: repo } = require('./users.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { hashPassword } = require('../../core/utils/password');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

async function assertRoleExists(roleId) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw AppError.badRequest('Selected role does not exist');
  return role;
}

const usersService = {
  async list(query) {
    const { page, limit, skip, take } = getPagination(query);
    const where = { deletedAt: null };
    if (query.status) where.status = query.status;
    if (query.roleId) where.roleId = query.roleId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { email: { contains: query.search } },
        { phone: { contains: query.search } },
      ];
    }
    const { rows, total } = await repo.findMany({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async get(id) {
    const user = await repo.findById(id);
    if (!user) throw AppError.notFound('User not found');
    return user;
  },

  async create(payload, actor, req) {
    await assertRoleExists(payload.roleId);
    const { password, ...rest } = payload;
    const user = await repo.create({
      ...rest,
      passwordHash: await hashPassword(password),
    });
    activity.record({ userId: actor.id, action: 'user.created', entityType: 'user', entityId: user.id, req });
    return user;
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findRawById(id);
    if (!existing) throw AppError.notFound('User not found');
    if (payload.roleId) await assertRoleExists(payload.roleId);

    // Don't let someone lock themselves out by deactivating their own account.
    if (id === actor.id && payload.status && payload.status !== 'ACTIVE') {
      throw AppError.badRequest('You cannot deactivate your own account');
    }

    const user = await repo.update(id, payload);
    activity.record({ userId: actor.id, action: 'user.updated', entityType: 'user', entityId: id, req });
    return user;
  },

  async remove(id, actor, req) {
    const existing = await repo.findRawById(id);
    if (!existing) throw AppError.notFound('User not found');
    if (id === actor.id) throw AppError.badRequest('You cannot delete your own account');

    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'user.deleted', entityType: 'user', entityId: id, req });
    return { success: true };
  },

  async resetPassword(id, newPassword, actor, req) {
    const existing = await repo.findRawById(id);
    if (!existing) throw AppError.notFound('User not found');
    await repo.updatePassword(id, await hashPassword(newPassword));
    // Invalidate the target user's existing sessions.
    await prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    activity.record({ userId: actor.id, action: 'user.password_reset', entityType: 'user', entityId: id, req });
    return { success: true };
  },
};

module.exports = usersService;
