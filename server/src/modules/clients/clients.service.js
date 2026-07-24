'use strict';

const repo = require('./clients.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

function statsFromCounts(rows) {
  // rows: [{ clientName, status, _count }]
  const map = {};
  for (const r of rows) {
    const m = (map[r.clientName] ||= { total: 0, completed: 0 });
    m.total += r._count._all;
    if (r.status === 'completed') m.completed += r._count._all;
  }
  return map;
}

const clientsService = {
  async list(query) {
    // Backfill the directory from any projects whose client isn't recorded yet.
    const distinct = await repo.distinctProjectClients();
    if (distinct.length) await repo.ensureClients(distinct);

    const { page, limit, skip, take } = getPagination(query);
    const where = { deletedAt: null };
    if (query.search) where.name = { contains: query.search };

    const [{ rows, total }, statRows] = await Promise.all([repo.list({ where, skip, take }), repo.statsByClient()]);
    const stats = statsFromCounts(statRows);

    const data = rows.map((c) => {
      const s = stats[c.name] || { total: 0, completed: 0 };
      return { ...c, totalProjects: s.total, completedProjects: s.completed, activeProjects: s.total - s.completed };
    });
    return { data, meta: buildMeta(page, limit, total) };
  },

  async get(id) {
    const client = await repo.findById(id);
    if (!client) throw AppError.notFound('Client not found');
    const projects = await repo.clientProjects(client.name);
    const completed = projects.filter((p) => p.status === 'completed').length;
    return {
      ...client,
      totalProjects: projects.length,
      completedProjects: completed,
      activeProjects: projects.length - completed,
      projects,
    };
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Client not found');
    const data = { ...payload };
    if (data.email === '') data.email = null;
    const client = await repo.update(id, data);
    activity.record({ userId: actor.id, action: 'client.updated', entityType: 'client', entityId: id, req });
    return client;
  },
};

module.exports = clientsService;
