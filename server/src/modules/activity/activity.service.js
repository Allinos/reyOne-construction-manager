'use strict';

const repo = require('./activity.repository');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const activityService = {
  async list(query) {
    const { page, limit, skip, take } = getPagination(query, { defaultLimit: 30 });
    const where = {};
    if (query.userId) where.userId = query.userId;
    if (query.action) where.action = { contains: query.action };
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = query.from;
      if (query.to) where.createdAt.lte = query.to;
    }
    const { rows, total } = await repo.findMany({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },
};

module.exports = activityService;
