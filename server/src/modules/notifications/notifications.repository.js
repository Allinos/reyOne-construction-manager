'use strict';

const prisma = require('../../config/prisma');

const notificationsRepository = {
  async list({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.notification.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      prisma.notification.count({ where }),
    ]);
    return { rows, total };
  },
  unreadCount(userId) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },
  markRead(id, userId) {
    return prisma.notification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } });
  },
  markAllRead(userId) {
    return prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  },
  remove(id, userId) {
    return prisma.notification.deleteMany({ where: { id, userId } });
  },
};

module.exports = notificationsRepository;
