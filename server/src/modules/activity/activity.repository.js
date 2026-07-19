'use strict';

const prisma = require('../../config/prisma');

const activityRepository = {
  async findMany({ where, skip, take }) {
    const [rows, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.activityLog.count({ where }),
    ]);
    return { rows, total };
  },
};

module.exports = activityRepository;
