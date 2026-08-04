'use strict';

const repo = require('./workforce.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const workforceService = {
  async list(query) {
    const { page, limit, skip, take } = getPagination(query, { defaultLimit: 30 });
    const where = { deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [{ name: { contains: query.search } }, { phone: { contains: query.search } }];
    }
    const orderBy = { [query.sortBy || 'name']: query.order || 'asc' };
    const { rows, total } = await repo.list({ where, skip, take, orderBy });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async get(id) {
    const member = await repo.findById(id);
    if (!member) throw AppError.notFound('Workforce member not found');
    return member;
  },

  async create(payload, actor, req) {
    const member = await repo.create(payload);
    activity.record({ userId: actor.id, action: 'workforce.created', entityType: 'workforce', entityId: member.id, req });
    return member;
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Workforce member not found');
    const member = await repo.update(id, payload);
    activity.record({ userId: actor.id, action: 'workforce.updated', entityType: 'workforce', entityId: id, req });
    return member;
  },

  async remove(id, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Workforce member not found');
    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'workforce.deleted', entityType: 'workforce', entityId: id, req });
    return { success: true };
  },
};

module.exports = workforceService;
