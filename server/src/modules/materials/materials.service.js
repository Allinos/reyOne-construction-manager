'use strict';

const { Prisma } = require('@prisma/client');
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notifyMany, notify } = require('../../core/services/notify');
const { userNames, projectNames } = require('../../core/services/people');
const { accessibleProjectIds, assertProjectAccess, usersWithPermission } = require('../../core/services/access');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const num = (v) => Number(v || 0);
const r3 = (n) => Math.round(n * 1000) / 1000;
const D = (v) => new Prisma.Decimal(v || 0);
const loc = (projectId) => (projectId ? Number(projectId) : null);

async function getSetting(group, key, fallback) {
  const row = await prisma.setting.findUnique({ where: { group_key: { group, key } } });
  return row ? row.value : fallback;
}

// Balance of one material at one location (null = central store).
async function balance(materialId, projectId, tx = prisma) {
  const agg = await tx.stockMovement.aggregate({ where: { materialId, projectId: loc(projectId) }, _sum: { quantity: true } });
  return num(agg._sum.quantity);
}

async function assertMaterial(id) {
  const m = await prisma.material.findFirst({ where: { id, deletedAt: null } });
  if (!m) throw AppError.notFound('Material not found');
  return m;
}

async function move(tx, data) {
  return tx.stockMovement.create({ data: { ...data, quantity: D(data.quantity), rate: data.rate != null ? D(data.rate) : null } });
}

// Shared transfer used by manual transfers and request fulfilment.
async function doTransfer(tx, { materialId, quantity, fromProjectId, toProjectId, date, notes, requestId, actorId }) {
  if (loc(fromProjectId) === loc(toProjectId)) throw AppError.badRequest('Source and destination are the same');
  const available = await balance(materialId, fromProjectId, tx);
  if (quantity > available + 1e-9) {
    const m = await tx.material.findUnique({ where: { id: materialId } });
    throw AppError.badRequest(`Not enough ${m?.name || 'stock'} at source (available ${r3(available)} ${m?.unit || ''})`);
  }
  const base = { materialId, date: date || new Date(), notes: notes || null, requestId: requestId || null, createdById: actorId };
  await move(tx, { ...base, projectId: loc(fromProjectId), type: 'TRANSFER_OUT', quantity: -quantity });
  await move(tx, { ...base, projectId: loc(toProjectId), type: 'TRANSFER_IN', quantity });
}

const materialsService = {
  // --- materials ---
  async listItems(query) {
    const where = { deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.search) where.name = { contains: query.search };
    const items = await prisma.material.findMany({ where, orderBy: { name: 'asc' } });
    const sums = await prisma.stockMovement.groupBy({ by: ['materialId', 'projectId'], _sum: { quantity: true } });
    const store = new Map();
    const sites = new Map();
    for (const s of sums) {
      const q = num(s._sum.quantity);
      if (s.projectId == null) store.set(s.materialId, (store.get(s.materialId) || 0) + q);
      else sites.set(s.materialId, (sites.get(s.materialId) || 0) + q);
    }
    return items.map((m) => {
      const inStore = r3(store.get(m.id) || 0);
      const atSites = r3(sites.get(m.id) || 0);
      return { ...m, inStore, atSites, total: r3(inStore + atSites), low: num(m.reorderLevel) > 0 && inStore <= num(m.reorderLevel) };
    });
  },
  async createItem(payload, actor, req) {
    const m = await prisma.material.create({ data: { name: payload.name, unit: payload.unit || 'nos', category: payload.category || null, reorderLevel: D(payload.reorderLevel), notes: payload.notes || null } });
    activity.record({ userId: actor.id, action: 'material.created', entityType: 'material', entityId: m.id, req });
    return m;
  },
  async updateItem(id, payload, actor, req) {
    await assertMaterial(id);
    const data = { ...payload };
    if (data.reorderLevel !== undefined) data.reorderLevel = D(data.reorderLevel);
    const m = await prisma.material.update({ where: { id }, data });
    activity.record({ userId: actor.id, action: 'material.updated', entityType: 'material', entityId: id, req });
    return m;
  },
  async removeItem(id, actor, req) {
    await assertMaterial(id);
    await prisma.material.update({ where: { id }, data: { deletedAt: new Date() } });
    activity.record({ userId: actor.id, action: 'material.deleted', entityType: 'material', entityId: id, req });
    return { success: true };
  },

  // Stock at one location (store when projectId omitted).
  // Where one material is held: central store + each site with a balance.
  async locations(id, actor) {
    await assertMaterial(id);
    const sums = await prisma.stockMovement.groupBy({ by: ['projectId'], where: { materialId: id }, _sum: { quantity: true } });
    const allowed = await accessibleProjectIds(actor);
    const visible = sums.filter((s) => s.projectId == null || allowed === null || allowed.includes(s.projectId));
    const names = await projectNames(visible.map((s) => s.projectId));
    return visible
      .map((s) => ({ projectId: s.projectId, location: s.projectId ? names.get(s.projectId)?.name || `Project #${s.projectId}` : 'Central Store', quantity: r3(num(s._sum.quantity)) }))
      .filter((r) => r.projectId == null || r.quantity !== 0)
      .sort((a, b) => (a.projectId == null ? -1 : b.projectId == null ? 1 : b.quantity - a.quantity));
  },

  async stock(query, actor) {
    const projectId = loc(query.projectId);
    if (projectId) await assertProjectAccess(actor, projectId);
    const [items, sums] = await Promise.all([
      prisma.material.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } }),
      prisma.stockMovement.groupBy({ by: ['materialId'], where: { projectId }, _sum: { quantity: true } }),
    ]);
    const byId = new Map(sums.map((s) => [s.materialId, num(s._sum.quantity)]));
    return items
      .map((m) => ({ materialId: m.id, name: m.name, unit: m.unit, category: m.category, quantity: r3(byId.get(m.id) || 0), reorderLevel: num(m.reorderLevel), low: !projectId && num(m.reorderLevel) > 0 && (byId.get(m.id) || 0) <= num(m.reorderLevel) }))
      .filter((r) => query.all === 'true' || r.quantity !== 0 || !projectId);
  },

  async movements(query, actor) {
    const { page, limit, skip, take } = getPagination(query);
    const where = {};
    if (query.materialId) where.materialId = query.materialId;
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.type) where.type = query.type;
    if (query.projectId === 'store') where.projectId = null;
    else if (query.projectId) where.projectId = Number(query.projectId);
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null && where.projectId === undefined) where.projectId = { in: allowed };
    if (allowed !== null && typeof where.projectId === 'number' && !allowed.includes(where.projectId)) throw AppError.forbidden('You are not assigned to this project');
    const [rows, total] = await Promise.all([
      prisma.stockMovement.findMany({ where, skip, take, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
      prisma.stockMovement.count({ where }),
    ]);
    const [mats, projects, vendors, users] = await Promise.all([
      prisma.material.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.materialId))] } }, select: { id: true, name: true, unit: true } }),
      projectNames(rows.map((r) => r.projectId)),
      prisma.vendor.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.vendorId).filter(Boolean))] } }, select: { id: true, name: true } }),
      userNames(rows.map((r) => r.createdById)),
    ]);
    const mm = new Map(mats.map((m) => [m.id, m]));
    const vm = new Map(vendors.map((v) => [v.id, v.name]));
    return {
      data: rows.map((r) => ({
        ...r,
        materialName: mm.get(r.materialId)?.name, unit: mm.get(r.materialId)?.unit,
        location: r.projectId ? projects.get(r.projectId)?.name || `Project #${r.projectId}` : 'Central Store',
        vendorName: r.vendorId ? vm.get(r.vendorId) || null : null,
        createdByName: users.get(r.createdById) || null,
      })),
      meta: buildMeta(page, limit, total),
    };
  },

  // --- stock operations ---
  async purchase(payload, actor, req) {
    const m = await assertMaterial(payload.materialId);
    if (payload.projectId) await assertProjectAccess(actor, payload.projectId);
    const row = await move(prisma, {
      materialId: m.id, projectId: loc(payload.projectId), type: 'PURCHASE', quantity: payload.quantity,
      rate: payload.rate ?? null, vendorId: payload.vendorId ?? null, date: payload.date || new Date(), notes: payload.notes || null, createdById: actor.id,
    });
    activity.record({ userId: actor.id, action: 'material.purchased', entityType: 'material', entityId: m.id, req });
    const amount = num(payload.rate) * num(payload.quantity);
    if (payload.addToExpenses !== false && amount > 0) {
      try {
        const accounts = await getSetting('finance', 'accounts', []);
        const acc = Array.isArray(accounts) && accounts[0] ? accounts[0].key || accounts[0] : 'cash';
        const paid = payload.paymentStatus === 'CREDIT' ? 0 : amount;
        await prisma.expense.create({
          data: {
            scope: payload.projectId ? 'PROJECT' : 'COMPANY', projectId: loc(payload.projectId), category: 'Materials',
            amount: D(amount), amountPaid: D(paid), paymentStatus: payload.paymentStatus === 'CREDIT' ? 'CREDIT' : 'PAID',
            date: row.date, method: payload.method || 'Cash', account: acc, vendorId: payload.vendorId ?? null,
            notes: `${m.name} × ${payload.quantity} ${m.unit}${payload.notes ? ` — ${payload.notes}` : ''}`, createdById: actor.id,
          },
        });
      } catch {
        /* best-effort */
      }
    }
    return row;
  },

  async transfer(payload, actor, req) {
    await assertMaterial(payload.materialId);
    for (const p of [payload.fromProjectId, payload.toProjectId]) if (p) await assertProjectAccess(actor, p);
    await prisma.$transaction((tx) => doTransfer(tx, { ...payload, actorId: actor.id }));
    activity.record({ userId: actor.id, action: 'material.transferred', entityType: 'material', entityId: payload.materialId, req });
    return { success: true };
  },

  async consume(payload, actor, req) {
    const m = await assertMaterial(payload.materialId);
    await assertProjectAccess(actor, payload.projectId);
    await prisma.$transaction(async (tx) => {
      const available = await balance(m.id, payload.projectId, tx);
      if (payload.quantity > available + 1e-9) throw AppError.badRequest(`Only ${r3(available)} ${m.unit} of ${m.name} available at this site`);
      await move(tx, { materialId: m.id, projectId: loc(payload.projectId), type: 'CONSUME', quantity: -payload.quantity, date: payload.date || new Date(), notes: payload.notes || null, createdById: actor.id });
    });
    activity.record({ userId: actor.id, action: 'material.consumed', entityType: 'material', entityId: m.id, req });
    return { success: true };
  },

  async adjust(payload, actor, req) {
    const m = await assertMaterial(payload.materialId);
    await prisma.$transaction(async (tx) => {
      const available = await balance(m.id, payload.projectId, tx);
      if (available + payload.quantity < -1e-9) throw AppError.badRequest('Adjustment would make stock negative');
      await move(tx, { materialId: m.id, projectId: loc(payload.projectId), type: payload.quantity < 0 && payload.reason === 'return' ? 'RETURN' : 'ADJUST', quantity: payload.quantity, date: new Date(), notes: payload.notes || null, createdById: actor.id });
    });
    activity.record({ userId: actor.id, action: 'material.adjusted', entityType: 'material', entityId: m.id, req });
    return { success: true };
  },

  // --- requests ---
  async listRequests(query, actor) {
    const where = {};
    if (query.status) where.status = query.status;
    if (query.projectId) where.projectId = query.projectId;
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null) where.projectId = query.projectId ? (allowed.includes(query.projectId) ? query.projectId : -1) : { in: allowed };
    const rows = await prisma.materialRequest.findMany({ where, orderBy: { id: 'desc' }, take: 200 });
    const [projects, users] = await Promise.all([projectNames(rows.map((r) => r.projectId)), userNames(rows.flatMap((r) => [r.requestedById, r.decidedById]))]);
    return rows.map((r) => ({ ...r, projectName: projects.get(r.projectId)?.name || null, requestedByName: users.get(r.requestedById) || null, decidedByName: users.get(r.decidedById) || null }));
  },

  async createRequest(payload, actor, req) {
    await assertProjectAccess(actor, payload.projectId);
    const project = await prisma.project.findFirst({ where: { id: payload.projectId, deletedAt: null } });
    if (!project) throw AppError.notFound('Project not found');
    const mats = await prisma.material.findMany({ where: { id: { in: payload.items.map((i) => i.materialId) }, deletedAt: null } });
    const mm = new Map(mats.map((m) => [m.id, m]));
    const items = payload.items.map((i) => {
      const m = mm.get(i.materialId);
      if (!m) throw AppError.badRequest('Unknown material in request');
      return { materialId: m.id, name: m.name, unit: m.unit, quantity: num(i.quantity), approvedQty: null, fulfilledQty: 0 };
    });
    const row = await prisma.materialRequest.create({
      data: { projectId: payload.projectId, requestedById: actor.id, priority: payload.priority || 'normal', neededBy: payload.neededBy || null, notes: payload.notes || null, items },
    });
    activity.record({ userId: actor.id, action: 'material.request_created', entityType: 'material_request', entityId: row.id, req });
    const approvers = (await usersWithPermission('materials.approve')).filter((id) => id !== actor.id);
    notifyMany(approvers, { type: 'materials.request', title: 'Material request', message: `${actor.name} requested ${items.length} item(s) for ${project.name}.`, entityType: 'material_request', entityId: row.id });
    return row;
  },

  async decideRequest(id, payload, actor, req) {
    const r = await prisma.materialRequest.findUnique({ where: { id } });
    if (!r) throw AppError.notFound('Request not found');
    if (r.status !== 'pending') throw AppError.badRequest('This request has already been decided');
    const approve = payload.decision === 'approve';
    const approved = new Map((payload.items || []).map((i) => [i.materialId, num(i.approvedQty)]));
    const items = r.items.map((i) => ({ ...i, approvedQty: approve ? (approved.has(i.materialId) ? approved.get(i.materialId) : i.quantity) : 0 }));
    const row = await prisma.materialRequest.update({ where: { id }, data: { status: approve ? 'approved' : 'rejected', items, decidedById: actor.id, decidedAt: new Date(), decisionNote: payload.note || null } });
    activity.record({ userId: actor.id, action: `material.request_${row.status}`, entityType: 'material_request', entityId: id, req });
    notify({ userId: r.requestedById, type: 'materials.request_decided', title: `Material request ${row.status}`, message: payload.note || `Your material request #${id} was ${row.status}.`, entityType: 'material_request', entityId: id });
    return row;
  },

  // Issue approved quantities from the central store to the request's site.
  async fulfillRequest(id, payload, actor, req) {
    const r = await prisma.materialRequest.findUnique({ where: { id } });
    if (!r) throw AppError.notFound('Request not found');
    if (!['approved', 'partially_fulfilled'].includes(r.status)) throw AppError.badRequest('Only approved requests can be fulfilled');
    const qty = new Map((payload.items || []).map((i) => [i.materialId, num(i.quantity)]));
    const items = r.items.map((i) => ({ ...i }));
    let sent = 0;
    await prisma.$transaction(async (tx) => {
      for (const i of items) {
        const remaining = num(i.approvedQty ?? i.quantity) - num(i.fulfilledQty);
        const available = await balance(i.materialId, payload.fromProjectId || null, tx);
        // Send what is asked (default: all remaining), capped by source stock.
        const q = r3(Math.min(qty.has(i.materialId) ? qty.get(i.materialId) : remaining, remaining, Math.max(0, available)));
        if (q <= 0) continue;
        sent += 1;
        await doTransfer(tx, { materialId: i.materialId, quantity: q, fromProjectId: payload.fromProjectId || null, toProjectId: r.projectId, notes: `Request #${id}`, requestId: id, actorId: actor.id });
        i.fulfilledQty = r3(num(i.fulfilledQty) + q);
      }
    });
    if (!sent) throw AppError.badRequest('Nothing to dispatch — the source has no stock of the approved materials');
    const done = items.every((i) => num(i.fulfilledQty) >= num(i.approvedQty ?? i.quantity) - 1e-9);
    const row = await prisma.materialRequest.update({ where: { id }, data: { items, status: done ? 'fulfilled' : 'partially_fulfilled' } });
    activity.record({ userId: actor.id, action: 'material.request_fulfilled', entityType: 'material_request', entityId: id, req });
    notify({ userId: r.requestedById, type: 'materials.request_fulfilled', title: done ? 'Materials dispatched' : 'Materials partly dispatched', message: `Materials for request #${id} have been sent to site.`, entityType: 'material_request', entityId: id });
    return row;
  },

  // Site-wise consumption for a month (or all time).
  async consumption(query, actor) {
    const where = { type: 'CONSUME' };
    if (query.month) {
      const [y, m] = query.month.split('-').map(Number);
      where.date = { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
    }
    if (query.projectId) where.projectId = query.projectId;
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null) where.projectId = query.projectId ? (allowed.includes(query.projectId) ? query.projectId : -1) : { in: allowed };
    const groups = await prisma.stockMovement.groupBy({ by: ['projectId', 'materialId'], where, _sum: { quantity: true } });
    const [mats, projects] = await Promise.all([
      prisma.material.findMany({ where: { id: { in: [...new Set(groups.map((g) => g.materialId))] } }, select: { id: true, name: true, unit: true } }),
      projectNames(groups.map((g) => g.projectId)),
    ]);
    const mm = new Map(mats.map((m) => [m.id, m]));
    return groups.map((g) => ({
      projectId: g.projectId, projectName: projects.get(g.projectId)?.name || '—',
      materialId: g.materialId, materialName: mm.get(g.materialId)?.name, unit: mm.get(g.materialId)?.unit,
      quantity: r3(-num(g._sum.quantity)),
    })).sort((a, b) => (a.projectName || '').localeCompare(b.projectName || '') || (a.materialName || '').localeCompare(b.materialName || ''));
  },

  async analytics(actor) {
    const items = await this.listItems({});
    const allowed = await accessibleProjectIds(actor);
    const reqWhere = { status: 'pending', ...(allowed !== null ? { projectId: { in: allowed } } : {}) };
    const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
    const [pending, purchases] = await Promise.all([
      prisma.materialRequest.count({ where: reqWhere }),
      prisma.stockMovement.findMany({ where: { type: 'PURCHASE', date: { gte: start } }, select: { quantity: true, rate: true } }),
    ]);
    return {
      materials: items.length,
      lowStock: items.filter((i) => i.low).length,
      lowStockItems: items.filter((i) => i.low).slice(0, 10).map((i) => ({ id: i.id, name: i.name, inStore: i.inStore, unit: i.unit, reorderLevel: num(i.reorderLevel) })),
      pendingRequests: pending,
      purchaseValueThisMonth: Math.round(purchases.reduce((s, p) => s + num(p.quantity) * num(p.rate), 0) * 100) / 100,
    };
  },
};

module.exports = materialsService;
