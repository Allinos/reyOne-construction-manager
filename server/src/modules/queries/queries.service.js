'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notifyMany } = require('../../core/services/notify');
const { userNames, projectNames } = require('../../core/services/people');
const { accessibleProjectIds, assertProjectAccess, hasPerm, usersWithPermission } = require('../../core/services/access');

const ids = (q) => (Array.isArray(q.assigneeIds) ? q.assigneeIds.map(Number) : []);

/**
 * Visibility rules:
 *  - queries.manage holders see everything.
 *  - everyone else sees queries they raised, queries assigned to them, and
 *    "visible to everyone" queries on projects they can access (or with no project).
 */
async function canSee(q, actor, allowed) {
  if (hasPerm(actor, 'queries.manage')) return true;
  if (q.createdById === actor.id || ids(q).includes(actor.id)) return true;
  if (q.visibility === 'all') return !q.projectId || allowed === null || allowed.includes(q.projectId);
  return false;
}

async function load(id) {
  const q = await prisma.query.findFirst({ where: { id, deletedAt: null } });
  if (!q) throw AppError.notFound('Query not found');
  return q;
}

async function decorate(rows) {
  const [projects, users] = await Promise.all([
    projectNames(rows.map((r) => r.projectId)),
    userNames(rows.flatMap((r) => [r.createdById, ...ids(r)])),
  ]);
  return rows.map((r) => ({
    ...r,
    projectName: r.projectId ? projects.get(r.projectId)?.name || null : null,
    createdByName: users.get(r.createdById) || null,
    assignees: ids(r).map((id) => ({ id, name: users.get(id) || 'Unknown' })),
  }));
}

const queriesService = {
  async list(query, actor) {
    const where = { deletedAt: null };
    if (query.status === 'active') where.status = { in: ['open', 'in_progress'] };
    else if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.priority) where.priority = query.priority;
    if (query.search) where.title = { contains: query.search };
    const rows = await prisma.query.findMany({ where, orderBy: [{ updatedAt: 'desc' }], take: 500, include: { _count: { select: { replies: true } } } });
    const allowed = await accessibleProjectIds(actor);
    const visible = [];
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await canSee(r, actor, allowed))) continue;
      if (query.scope === 'mine' && !(r.createdById === actor.id || ids(r).includes(actor.id))) continue;
      if (query.scope === 'assigned' && !ids(r).includes(actor.id)) continue;
      visible.push({ ...r, replyCount: r._count.replies, _count: undefined });
    }
    return decorate(visible);
  },

  async get(id, actor) {
    const q = await load(id);
    if (!(await canSee(q, actor, await accessibleProjectIds(actor)))) throw AppError.forbidden('You cannot view this query');
    const replies = await prisma.queryReply.findMany({ where: { queryId: id }, orderBy: { id: 'asc' } });
    const names = await userNames(replies.map((r) => r.userId));
    const files = await prisma.storedFile.findMany({ where: { entityType: 'query', entityId: id }, select: { id: true, name: true, mimeType: true, size: true, createdAt: true, uploadedById: true } });
    const [dq] = await decorate([q]);
    return { ...dq, replies: replies.map((r) => ({ ...r, userName: names.get(r.userId) || 'Unknown' })), files };
  },

  async create(payload, actor, req) {
    if (payload.projectId) await assertProjectAccess(actor, payload.projectId);
    const assigneeIds = [...new Set(payload.assigneeIds || [])];
    if (assigneeIds.length) {
      const n = await prisma.user.count({ where: { id: { in: assigneeIds }, deletedAt: null } });
      if (n !== assigneeIds.length) throw AppError.badRequest('One or more assignees do not exist');
    }
    const q = await prisma.query.create({
      data: {
        projectId: payload.projectId || null,
        title: payload.title,
        description: payload.description || null,
        priority: payload.priority || 'normal',
        visibility: payload.visibility || (assigneeIds.length ? 'assigned' : 'all'),
        assigneeIds,
        createdById: actor.id,
      },
    });
    activity.record({ userId: actor.id, action: 'query.created', entityType: 'query', entityId: q.id, req });
    // Assigned → notify assignees; otherwise notify query managers.
    const recipients = assigneeIds.length ? assigneeIds : await usersWithPermission('queries.manage');
    notifyMany(recipients.filter((id) => id !== actor.id), {
      type: 'query.created',
      title: `${q.priority === 'urgent' ? 'URGENT query' : 'New query'}: ${q.title}`.slice(0, 190),
      message: `${actor.name} raised a query${payload.projectId ? '' : ''}.`,
      entityType: 'query',
      entityId: q.id,
    });
    return q;
  },

  async update(id, payload, actor, req) {
    const q = await load(id);
    const isManager = hasPerm(actor, 'queries.manage');
    const isOwner = q.createdById === actor.id;
    const isAssignee = ids(q).includes(actor.id);
    if (!isManager && !isOwner && !isAssignee) throw AppError.forbidden('You cannot update this query');
    if (!isManager && !isOwner) {
      // Assignees can only move the status along.
      for (const k of Object.keys(payload)) if (k !== 'status') delete payload[k];
    }
    const data = { ...payload };
    if (data.assigneeIds) data.assigneeIds = [...new Set(data.assigneeIds)];
    const updated = await prisma.query.update({ where: { id }, data });
    activity.record({ userId: actor.id, action: 'query.updated', entityType: 'query', entityId: id, req });

    const added = (data.assigneeIds || []).filter((u) => !ids(q).includes(u) && u !== actor.id);
    if (added.length) notifyMany(added, { type: 'query.assigned', title: `Query assigned: ${q.title}`.slice(0, 190), message: `${actor.name} assigned you a query.`, entityType: 'query', entityId: id });
    if (data.status && data.status !== q.status) {
      const watchers = [q.createdById, ...ids(updated)].filter((u) => u !== actor.id);
      notifyMany(watchers, { type: 'query.status', title: `Query ${data.status.replace('_', ' ')}: ${q.title}`.slice(0, 190), message: `${actor.name} changed the status.`, entityType: 'query', entityId: id });
    }
    return updated;
  },

  async reply(id, payload, actor, req) {
    const q = await load(id);
    if (!(await canSee(q, actor, await accessibleProjectIds(actor)))) throw AppError.forbidden('You cannot reply to this query');
    const reply = await prisma.queryReply.create({ data: { queryId: id, userId: actor.id, message: payload.message } });
    const data = { updatedAt: new Date() };
    // A reply from an assignee on an open query moves it to in-progress.
    if (q.status === 'open' && ids(q).includes(actor.id)) data.status = 'in_progress';
    await prisma.query.update({ where: { id }, data });
    activity.record({ userId: actor.id, action: 'query.replied', entityType: 'query', entityId: id, req });
    const prev = await prisma.queryReply.findMany({ where: { queryId: id }, select: { userId: true }, distinct: ['userId'] });
    const watchers = [q.createdById, ...ids(q), ...prev.map((p) => p.userId)].filter((u) => u !== actor.id);
    notifyMany(watchers, { type: 'query.reply', title: `New reply: ${q.title}`.slice(0, 190), message: `${actor.name}: ${payload.message.slice(0, 140)}`, entityType: 'query', entityId: id });
    return reply;
  },

  async remove(id, actor, req) {
    const q = await load(id);
    if (!hasPerm(actor, 'queries.manage') && q.createdById !== actor.id) throw AppError.forbidden('Only the creator or a manager can delete this query');
    await prisma.query.update({ where: { id }, data: { deletedAt: new Date() } });
    activity.record({ userId: actor.id, action: 'query.deleted', entityType: 'query', entityId: id, req });
    return { success: true };
  },

  async counts(actor) {
    const list = await this.list({ status: 'active' }, actor);
    return {
      active: list.length,
      assignedToMe: list.filter((q) => ids(q).includes(actor.id)).length,
      urgent: list.filter((q) => q.priority === 'urgent' || q.priority === 'high').length,
    };
  },
};

module.exports = queriesService;
