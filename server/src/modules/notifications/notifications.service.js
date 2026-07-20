'use strict';

const repo = require('./notifications.repository');
const AppError = require('../../core/errors/AppError');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const notificationsService = {
  async list(userId, query) {
    const { page, limit, skip, take } = getPagination(query, { defaultLimit: 20 });
    const where = { userId };
    if (query.unread === 'true' || query.unread === true) where.readAt = null;
    const { rows, total } = await repo.list({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async unreadCount(userId) {
    return { count: await repo.unreadCount(userId) };
  },

  async markRead(id, userId) {
    const res = await repo.markRead(id, userId);
    if (res.count === 0) throw AppError.notFound('Notification not found');
    return { success: true };
  },

  async markAllRead(userId) {
    await repo.markAllRead(userId);
    return { success: true };
  },

  async remove(id, userId) {
    const res = await repo.remove(id, userId);
    if (res.count === 0) throw AppError.notFound('Notification not found');
    return { success: true };
  },
};

module.exports = notificationsService;
