'use strict';

/**
 * Project queries / RFIs (requests for information).
 *
 * Status flow:
 *   open               raised, nobody assigned yet
 *   assigned           responder(s) assigned, no answer yet
 *   awaiting_response  the raiser (or others) followed up — waiting on the responder
 *   responded          a responder has answered — waiting on the raiser
 *   resolved           answer accepted, resolution recorded
 *   closed             archived
 * Replies move the status automatically; resolve/close/reopen are explicit.
 */
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notifyMany } = require('../../core/services/notify');
const { userNames, projectNames } = require('../../core/services/people');
const { accessibleProjectIds, assertProjectAccess, hasPerm, usersWithPermission } = require('../../core/services/access');

const ACTIVE = ['open', 'assigned', 'awaiting_response', 'responded'];
const LABEL = { open: 'Open', assigned: 'Assigned', awaiting_response: 'Awaiting response', responded: 'Responded', resolved: 'Resolved', closed: 'Closed' };
const LEGACY = { in_progress: 'assigned' };
const ids = (q) => (Array.isArray(q.assigneeIds) ? q.assigneeIds.map(Number) : []);
const mids = (q) => (Array.isArray(q.mentionIds) ? q.mentionIds.map(Number) : []);
const norm = (st) => LEGACY[st] || st;
const startOfToday = () => new Date(new Date().toDateString());

async function canSee(q, actor, allowed) {
  if (hasPerm(actor, 'queries.manage')) return true;
  if (q.createdById === actor.id || ids(q).includes(actor.id) || mids(q).includes(actor.id)) return true;
  if (q.visibility === 'all') return !q.projectId || allowed === null || allowed.includes(q.projectId);
  return false;
}

async function load(id) {
  const q = await prisma.query.findFirst({ where: { id, deletedAt: null } });
  if (!q) throw AppError.notFound('Query not found');
  return q;
}

async function nextNumber() {
  const last = await prisma.query.findFirst({ where: { number: { startsWith: 'Q-' } }, orderBy: { id: 'desc' }, select: { number: true } });
  const n = last ? Number(last.number.replace(/\D/g, '')) + 1 : 1;
  return `Q-${String(n).padStart(4, '0')}`;
}

async function assertUsers(list) {
  if (!list.length) return;
  const n = await prisma.user.count({ where: { id: { in: list }, deletedAt: null } });
  if (n !== list.length) throw AppError.badRequest('One or more selected people do not exist');
}

async function decorate(rows) {
  const phaseIds = [...new Set(rows.map((r) => r.phaseId).filter(Boolean))];
  const [projects, users, phases] = await Promise.all([
    projectNames(rows.map((r) => r.projectId)),
    userNames(rows.flatMap((r) => [r.createdById, r.resolvedById, ...ids(r), ...mids(r)])),
    phaseIds.length ? prisma.projectPhase.findMany({ where: { id: { in: phaseIds } }, select: { id: true, name: true } }) : [],
  ]);
  const pm = new Map(phases.map((p) => [p.id, p.name]));
  return rows.map((r) => {
    const status = norm(r.status);
    return {
      ...r,
      status,
      statusLabel: LABEL[status] || status,
      ref: r.number || `#${r.id}`,
      overdue: !!(r.dueDate && ACTIVE.includes(status) && new Date(r.dueDate) < startOfToday()),
      projectName: r.projectId ? projects.get(r.projectId)?.name || null : null,
      phaseName: r.phaseId ? pm.get(r.phaseId) || null : null,
      createdByName: users.get(r.createdById) || null,
      resolvedByName: r.resolvedById ? users.get(r.resolvedById) || null : null,
      assignees: ids(r).map((id) => ({ id, name: users.get(id) || 'Unknown' })),
      mentions: mids(r).map((id) => ({ id, name: users.get(id) || 'Unknown' })),
    };
  });
}

async function logEvent(queryId, userId, message) {
  await prisma.queryReply.create({ data: { queryId, userId, kind: 'event', message } });
}

const watchersOf = (q, extra = []) => [...new Set([q.createdById, ...ids(q), ...mids(q), ...extra])];

const queriesService = {
  LABEL,

  async list(query, actor) {
    const where = { deletedAt: null };
    if (query.status === 'active') where.status = { in: [...ACTIVE, 'in_progress'] };
    else if (query.status === 'assigned') where.status = { in: ['assigned', 'in_progress'] };
    else if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    if (query.phaseId) where.phaseId = query.phaseId;
    if (query.priority) where.priority = query.priority;
    if (query.type) where.type = query.type;
    if (query.search) where.OR = [{ title: { contains: query.search } }, { number: { contains: query.search } }, { location: { contains: query.search } }];
    const rows = await prisma.query.findMany({ where, orderBy: [{ updatedAt: 'desc' }], take: 500, include: { _count: { select: { replies: true } } } });
    const allowed = await accessibleProjectIds(actor);
    const visible = [];
    for (const r of rows) {
      // eslint-disable-next-line no-await-in-loop
      if (!(await canSee(r, actor, allowed))) continue;
      if (query.scope === 'mine' && !(r.createdById === actor.id || ids(r).includes(actor.id) || mids(r).includes(actor.id))) continue;
      if (query.scope === 'assigned' && !ids(r).includes(actor.id)) continue;
      if (query.scope === 'raised' && r.createdById !== actor.id) continue;
      visible.push({ ...r, replyCount: r._count.replies, _count: undefined });
    }
    let out = await decorate(visible);
    if (query.overdue === 'true') out = out.filter((q) => q.overdue);
    return out;
  },

  async get(id, actor) {
    const q = await load(id);
    if (!(await canSee(q, actor, await accessibleProjectIds(actor)))) throw AppError.forbidden('You cannot view this query');
    const replies = await prisma.queryReply.findMany({ where: { queryId: id }, orderBy: { id: 'asc' } });
    const names = await userNames(replies.map((r) => r.userId));
    const files = await prisma.storedFile.findMany({ where: { entityType: 'query', entityId: id }, select: { id: true, name: true, mimeType: true, size: true, createdAt: true, uploadedById: true } });
    const [dq] = await decorate([q]);
    return {
      ...dq,
      canManage: hasPerm(actor, 'queries.manage') || q.createdById === actor.id,
      isAssignee: ids(q).includes(actor.id),
      replies: replies.map((r) => ({ ...r, userName: names.get(r.userId) || 'Unknown' })),
      files,
    };
  },

  async create(payload, actor, req) {
    if (payload.projectId) await assertProjectAccess(actor, payload.projectId);
    if (payload.phaseId) {
      const ph = await prisma.projectPhase.findUnique({ where: { id: payload.phaseId } });
      if (!ph || ph.projectId !== payload.projectId) throw AppError.badRequest('The selected stage does not belong to this project');
    }
    const assigneeIds = [...new Set(payload.assigneeIds || [])];
    const mentionIds = [...new Set(payload.mentionIds || [])].filter((u) => !assigneeIds.includes(u));
    await assertUsers([...assigneeIds, ...mentionIds]);
    const q = await prisma.query.create({
      data: {
        number: await nextNumber(),
        type: payload.type || 'rfi',
        category: payload.category || null,
        projectId: payload.projectId || null,
        phaseId: payload.phaseId || null,
        location: payload.location || null,
        workItem: payload.workItem || null,
        title: payload.title,
        description: payload.description || null,
        priority: payload.priority || 'normal',
        status: assigneeIds.length ? 'assigned' : 'open',
        visibility: payload.visibility || (assigneeIds.length ? 'assigned' : 'all'),
        assigneeIds,
        mentionIds,
        dueDate: payload.dueDate || null,
        costImpact: !!payload.costImpact,
        scheduleImpact: !!payload.scheduleImpact,
        createdById: actor.id,
      },
    });
    activity.record({ userId: actor.id, action: 'query.created', entityType: 'query', entityId: q.id, req });
    const tag = `${q.number}${q.priority === 'urgent' ? ' · URGENT' : ''}`;
    if (assigneeIds.length) {
      notifyMany(assigneeIds.filter((u) => u !== actor.id), { type: 'query.assigned', title: `${tag}: ${q.title}`.slice(0, 190), message: `${actor.name} needs your response${q.dueDate ? ` by ${new Date(q.dueDate).toLocaleDateString('en-GB')}` : ''}.`, entityType: 'query', entityId: q.id });
    } else {
      const managers = await usersWithPermission('queries.manage');
      notifyMany(managers.filter((u) => u !== actor.id), { type: 'query.created', title: `New query ${tag}: ${q.title}`.slice(0, 190), message: `${actor.name} raised a query — not assigned yet.`, entityType: 'query', entityId: q.id });
    }
    if (mentionIds.length) notifyMany(mentionIds.filter((u) => u !== actor.id), { type: 'query.mention', title: `You were tagged on ${q.number}`, message: q.title.slice(0, 180), entityType: 'query', entityId: q.id });
    return q;
  },

  async update(id, payload, actor, req) {
    const q = await load(id);
    const isManager = hasPerm(actor, 'queries.manage');
    const isOwner = q.createdById === actor.id;
    if (!isManager && !isOwner) throw AppError.forbidden('Only the person who raised the query or a manager can edit it');
    const data = { ...payload };
    delete data.status; // status changes go through respond/resolve/close/reopen
    if (data.assigneeIds) data.assigneeIds = [...new Set(data.assigneeIds)];
    if (data.mentionIds) data.mentionIds = [...new Set(data.mentionIds)];
    await assertUsers([...(data.assigneeIds || []), ...(data.mentionIds || [])]);
    const st = norm(q.status);
    if (data.assigneeIds) {
      if (data.assigneeIds.length && st === 'open') data.status = 'assigned';
      if (!data.assigneeIds.length && ['assigned', 'awaiting_response'].includes(st)) data.status = 'open';
    }
    const updated = await prisma.query.update({ where: { id }, data });
    activity.record({ userId: actor.id, action: 'query.updated', entityType: 'query', entityId: id, req });
    const added = (data.assigneeIds || []).filter((u) => !ids(q).includes(u) && u !== actor.id);
    if (added.length) {
      await logEvent(id, actor.id, `Assigned to ${[...(await userNames(added)).values()].join(', ')}`);
      notifyMany(added, { type: 'query.assigned', title: `${q.number || 'Query'} assigned: ${q.title}`.slice(0, 190), message: `${actor.name} needs your response.`, entityType: 'query', entityId: id });
    }
    const tagged = (data.mentionIds || []).filter((u) => !mids(q).includes(u) && u !== actor.id);
    if (tagged.length) notifyMany(tagged, { type: 'query.mention', title: `You were tagged on ${q.number || 'a query'}`, message: q.title.slice(0, 180), entityType: 'query', entityId: id });
    return updated;
  },

  // Reply in the thread. Responders' replies count as a response; anyone
  // else's reply on an assigned/responded query is a follow-up.
  async reply(id, payload, actor, req) {
    const q = await load(id);
    if (!(await canSee(q, actor, await accessibleProjectIds(actor)))) throw AppError.forbidden('You cannot reply to this query');
    const st = norm(q.status);
    if (['resolved', 'closed'].includes(st)) throw AppError.badRequest('This query is resolved — reopen it to continue the discussion');
    const isResponder = ids(q).includes(actor.id);
    const reply = await prisma.queryReply.create({ data: { queryId: id, userId: actor.id, kind: isResponder ? 'response' : 'reply', message: payload.message } });
    const data = { updatedAt: new Date() };
    if (isResponder) data.status = 'responded';
    else if (st === 'responded' || (st === 'assigned' && actor.id === q.createdById)) data.status = 'awaiting_response';
    const tagged = [...new Set(payload.mentionIds || [])].filter((u) => u !== actor.id);
    if (tagged.length) {
      await assertUsers(tagged);
      data.mentionIds = [...new Set([...mids(q), ...tagged.filter((u) => !ids(q).includes(u))])];
    }
    await prisma.query.update({ where: { id }, data });
    activity.record({ userId: actor.id, action: 'query.replied', entityType: 'query', entityId: id, req });
    const prev = await prisma.queryReply.findMany({ where: { queryId: id }, select: { userId: true }, distinct: ['userId'] });
    const watchers = watchersOf(q, [...prev.map((p) => p.userId), ...tagged]).filter((u) => u !== actor.id);
    notifyMany(watchers, {
      type: tagged.length ? 'query.mention' : 'query.reply',
      title: `${isResponder ? 'Response' : 'Reply'} on ${q.number || 'query'}: ${q.title}`.slice(0, 190),
      message: `${actor.name}: ${payload.message.slice(0, 140)}`,
      entityType: 'query',
      entityId: id,
    });
    return reply;
  },

  async resolve(id, payload, actor, req) {
    const q = await load(id);
    if (!(hasPerm(actor, 'queries.manage') || q.createdById === actor.id)) throw AppError.forbidden('Only the person who raised it or a manager can resolve a query');
    if (['resolved', 'closed'].includes(norm(q.status))) throw AppError.badRequest('Already resolved');
    await prisma.query.update({ where: { id }, data: { status: 'resolved', resolution: payload.resolution, resolvedById: actor.id, resolvedAt: new Date() } });
    await logEvent(id, actor.id, `Resolved: ${payload.resolution}`);
    activity.record({ userId: actor.id, action: 'query.resolved', entityType: 'query', entityId: id, req });
    notifyMany(watchersOf(q).filter((u) => u !== actor.id), { type: 'query.status', title: `${q.number || 'Query'} resolved: ${q.title}`.slice(0, 190), message: payload.resolution.slice(0, 160), entityType: 'query', entityId: id });
    return { success: true };
  },

  async setState(id, action, actor, req) {
    const q = await load(id);
    if (!(hasPerm(actor, 'queries.manage') || q.createdById === actor.id)) throw AppError.forbidden('Only the person who raised it or a manager can do this');
    const st = norm(q.status);
    let data;
    if (action === 'close') {
      if (st === 'closed') throw AppError.badRequest('Already closed');
      data = { status: 'closed', closedAt: new Date() };
    } else {
      if (!['resolved', 'closed'].includes(st)) throw AppError.badRequest('Only resolved or closed queries can be reopened');
      data = { status: ids(q).length ? 'awaiting_response' : 'open', closedAt: null, resolvedAt: null, resolvedById: null };
    }
    await prisma.query.update({ where: { id }, data });
    await logEvent(id, actor.id, action === 'close' ? 'Closed' : 'Reopened');
    activity.record({ userId: actor.id, action: `query.${action}`, entityType: 'query', entityId: id, req });
    notifyMany(watchersOf(q).filter((u) => u !== actor.id), { type: 'query.status', title: `${q.number || 'Query'} ${action === 'close' ? 'closed' : 'reopened'}: ${q.title}`.slice(0, 190), message: `${actor.name} ${action === 'close' ? 'closed' : 'reopened'} the query.`, entityType: 'query', entityId: id });
    return { success: true };
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
      assignedToMe: list.filter((q) => ids(q).includes(actor.id) && ['assigned', 'awaiting_response'].includes(q.status)).length,
      awaitingMe: list.filter((q) => q.createdById === actor.id && q.status === 'responded').length,
      overdue: list.filter((q) => q.overdue).length,
      urgent: list.filter((q) => q.priority === 'urgent' || q.priority === 'high').length,
    };
  },
};

module.exports = queriesService;
