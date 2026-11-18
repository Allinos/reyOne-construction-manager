'use strict';

/**
 * Procurement: purchase orders and goods receipts (GRN).
 *
 * A PO is raised to a vendor for delivery to the central store or a site
 * (optionally from an approved site request). Receiving goods against it —
 * fully or in parts — adds stock at the delivery location, updates the PO's
 * received quantities and books the vendor's bill (an Expense with vendorId,
 * bill no. and due date) that Vendor Payments later settle.
 */
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { notify } = require('../../core/services/notify');
const { projectNames, userNames } = require('../../core/services/people');
const { accessibleProjectIds, assertProjectAccess } = require('../../core/services/access');

const num = (v) => Number(v || 0);
const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const D = (v) => new Prisma.Decimal(v || 0);

async function nextNumber(model, prefix) {
  const last = await prisma[model].findFirst({ where: { number: { startsWith: prefix } }, orderBy: { id: 'desc' }, select: { number: true } });
  const n = last ? Number(String(last.number).replace(/\D/g, '')) + 1 : 1;
  return `${prefix}${String(n).padStart(4, '0')}`;
}

async function defaultAccount() {
  const row = await prisma.setting.findUnique({ where: { group_key: { group: 'finance', key: 'accounts' } } });
  const list = Array.isArray(row?.value) ? row.value : [];
  return list[0] ? list[0].key || list[0] : 'cash';
}

function poTotals(po) {
  const items = po.items || [];
  const subtotal = items.reduce((s, i) => s + num(i.quantity) * num(i.rate), 0);
  const tax = (subtotal * num(po.taxPercent)) / 100;
  const ordered = items.reduce((s, i) => s + num(i.quantity), 0);
  const received = items.reduce((s, i) => s + Math.min(num(i.receivedQty), num(i.quantity)), 0);
  return { subtotal: r2(subtotal), tax: r2(tax), total: r2(subtotal + tax), receivedPct: ordered ? Math.round((received / ordered) * 100) : 0 };
}

async function hydrateItems(items) {
  const ids = [...new Set(items.map((i) => Number(i.materialId)))];
  const mats = await prisma.material.findMany({ where: { id: { in: ids }, deletedAt: null } });
  const byId = new Map(mats.map((m) => [m.id, m]));
  return items.map((i) => {
    const m = byId.get(Number(i.materialId));
    if (!m) throw AppError.badRequest('One of the materials no longer exists');
    return { materialId: m.id, name: m.name, unit: m.unit, quantity: r3(num(i.quantity)), rate: r2(num(i.rate)), receivedQty: r3(num(i.receivedQty)) };
  });
}

async function decorate(rows) {
  const [vendors, projects, users] = await Promise.all([
    prisma.vendor.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.vendorId).filter(Boolean))] } }, select: { id: true, name: true } }),
    projectNames(rows.map((r) => r.projectId)),
    userNames(rows.map((r) => r.createdById)),
  ]);
  const vm = new Map(vendors.map((v) => [v.id, v.name]));
  return rows.map((r) => ({
    ...r,
    vendorName: vm.get(r.vendorId) || null,
    location: r.projectId ? projects.get(r.projectId)?.name || `Project #${r.projectId}` : 'Central Store',
    createdByName: users.get(r.createdById) || null,
    ...(r.items && r.orderDate ? poTotals(r) : {}),
  }));
}

async function getPo(id) {
  const po = await prisma.purchaseOrder.findFirst({ where: { id, deletedAt: null } });
  if (!po) throw AppError.notFound('Purchase order not found');
  return po;
}

const procurement = {
  async listPOs(query, actor) {
    const where = { deletedAt: null };
    if (query.status === 'open') where.status = { in: ['ordered', 'partially_received'] };
    else if (query.status) where.status = query.status;
    if (query.vendorId) where.vendorId = Number(query.vendorId);
    if (query.projectId === 'store') where.projectId = null;
    else if (query.projectId) where.projectId = Number(query.projectId);
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null) where.OR = [{ projectId: null }, { projectId: { in: allowed } }];
    const rows = await prisma.purchaseOrder.findMany({ where, orderBy: [{ id: 'desc' }], take: 300 });
    return decorate(rows);
  },

  async getPO(id, actor) {
    const po = await getPo(id);
    if (po.projectId) await assertProjectAccess(actor, po.projectId);
    const [decorated] = await decorate([po]);
    const receipts = await prisma.goodsReceipt.findMany({ where: { purchaseOrderId: id }, orderBy: { id: 'desc' } });
    const vendor = await prisma.vendor.findUnique({ where: { id: po.vendorId } });
    return { ...decorated, vendor, receipts: await decorate(receipts) };
  },

  async createPO(payload, actor, req) {
    const vendor = await prisma.vendor.findFirst({ where: { id: payload.vendorId, deletedAt: null } });
    if (!vendor) throw AppError.badRequest('Select a vendor');
    if (payload.projectId) await assertProjectAccess(actor, payload.projectId);
    if (!payload.items?.length) throw AppError.badRequest('Add at least one material');
    const items = await hydrateItems(payload.items.map((i) => ({ ...i, receivedQty: 0 })));
    const po = await prisma.purchaseOrder.create({
      data: {
        number: await nextNumber('purchaseOrder', 'PO-'),
        vendorId: vendor.id,
        projectId: payload.projectId || null,
        requestId: payload.requestId || null,
        status: payload.status === 'ordered' ? 'ordered' : 'draft',
        orderDate: payload.orderDate || new Date(),
        expectedDate: payload.expectedDate || null,
        items,
        taxPercent: D(payload.taxPercent || 0),
        notes: payload.notes || null,
        terms: payload.terms || null,
        createdById: actor.id,
      },
    });
    if (payload.requestId) {
      await prisma.materialRequest.update({ where: { id: payload.requestId }, data: { decisionNote: `Ordered on ${po.number}` } }).catch(() => {});
    }
    activity.record({ userId: actor.id, action: 'purchase_order.created', entityType: 'purchase_order', entityId: po.id, req });
    return po;
  },

  async updatePO(id, payload, actor, req) {
    const po = await getPo(id);
    const data = {};
    if (payload.status) {
      const allowed = { draft: ['ordered', 'cancelled'], ordered: ['cancelled', 'draft'], partially_received: ['received'], received: [], cancelled: ['draft'] };
      if (!allowed[po.status]?.includes(payload.status)) throw AppError.badRequest(`A ${po.status.replace('_', ' ')} order can't be marked ${payload.status.replace('_', ' ')}`);
      if (payload.status === 'cancelled' && (po.items || []).some((i) => num(i.receivedQty) > 0)) throw AppError.badRequest('Goods were already received on this order — close it instead');
      data.status = payload.status;
    }
    // Only drafts can have their lines/vendor changed.
    const editing = ['items', 'vendorId', 'projectId', 'taxPercent'].some((k) => payload[k] !== undefined);
    if (editing && po.status !== 'draft') throw AppError.badRequest('Only draft orders can be edited');
    if (payload.items) data.items = await hydrateItems(payload.items.map((i) => ({ ...i, receivedQty: 0 })));
    for (const k of ['vendorId', 'projectId', 'expectedDate', 'notes', 'terms', 'orderDate']) if (payload[k] !== undefined) data[k] = payload[k];
    if (payload.taxPercent !== undefined) data.taxPercent = D(payload.taxPercent);
    const updated = await prisma.purchaseOrder.update({ where: { id }, data });
    activity.record({ userId: actor.id, action: 'purchase_order.updated', entityType: 'purchase_order', entityId: id, req });
    return updated;
  },

  async removePO(id, actor, req) {
    const po = await getPo(id);
    if (po.status !== 'draft' && po.status !== 'cancelled') throw AppError.badRequest('Only draft or cancelled orders can be deleted');
    await prisma.purchaseOrder.update({ where: { id }, data: { deletedAt: new Date() } });
    activity.record({ userId: actor.id, action: 'purchase_order.deleted', entityType: 'purchase_order', entityId: id, req });
    return { success: true };
  },

  /**
   * Record goods received (GRN). With purchaseOrderId the vendor, location and
   * rates come from the PO; without it this is a direct purchase.
   */
  async receive(payload, actor, req) {
    let po = null;
    if (payload.purchaseOrderId) {
      po = await getPo(payload.purchaseOrderId);
      if (!['ordered', 'partially_received'].includes(po.status)) throw AppError.badRequest('Mark the order as Ordered before receiving goods');
    }
    const vendorId = po ? po.vendorId : payload.vendorId || null;
    const projectId = po ? po.projectId : payload.projectId || null;
    if (projectId) await assertProjectAccess(actor, projectId);
    const lines = (payload.items || []).filter((i) => num(i.quantity) > 0);
    if (!lines.length) throw AppError.badRequest('Enter the quantity received for at least one material');

    let poItems = po ? po.items.map((i) => ({ ...i })) : null;
    const items = await hydrateItems(lines.map((l) => {
      const pi = poItems?.find((x) => x.materialId === Number(l.materialId));
      if (po && !pi) throw AppError.badRequest('A material is not on this purchase order');
      return { materialId: l.materialId, quantity: l.quantity, rate: l.rate ?? pi?.rate ?? 0 };
    }));
    const subtotal = items.reduce((s, i) => s + i.quantity * i.rate, 0);
    const taxPct = po ? num(po.taxPercent) : num(payload.taxPercent);
    const amount = r2(subtotal * (1 + taxPct / 100));
    const date = payload.date || new Date();
    const vendor = vendorId ? await prisma.vendor.findUnique({ where: { id: vendorId } }) : null;

    const result = await prisma.$transaction(async (tx) => {
      for (const i of items) {
        await tx.stockMovement.create({
          data: { materialId: i.materialId, projectId, type: 'PURCHASE', quantity: D(i.quantity), rate: D(i.rate), vendorId, date, notes: po ? `${po.number}` : payload.notes || null, createdById: actor.id },
        });
      }
      let expenseId = null;
      if (amount > 0 && payload.recordBill !== false) {
        const paidNow = payload.paidNow ? amount : 0;
        const due = payload.dueDate || (vendor?.creditDays ? new Date(new Date(date).getTime() + vendor.creditDays * 86400000) : null);
        const exp = await tx.expense.create({
          data: {
            scope: projectId ? 'PROJECT' : 'COMPANY', projectId, category: 'Materials', amount: D(amount), amountPaid: D(paidNow),
            paymentStatus: paidNow ? 'PAID' : 'CREDIT', date, method: payload.method || 'Credit', account: payload.account || (await defaultAccount()),
            vendorId, billNumber: payload.billNumber || null, dueDate: paidNow ? null : due, purchaseOrderId: po?.id || null,
            notes: `${po ? `${po.number} · ` : ''}${items.map((i) => `${i.name} × ${i.quantity} ${i.unit}`).join(', ')}`.slice(0, 1000),
            createdById: actor.id,
          },
        });
        expenseId = exp.id;
      }
      const grn = await tx.goodsReceipt.create({
        data: {
          number: await nextNumber('goodsReceipt', 'GRN-'), purchaseOrderId: po?.id || null, vendorId, projectId, date,
          items: items.map(({ receivedQty, ...rest }) => rest), billNumber: payload.billNumber || null, amount: D(amount), expenseId, notes: payload.notes || null, createdById: actor.id,
        },
      });
      if (po) {
        for (const i of items) {
          const pi = poItems.find((x) => x.materialId === i.materialId);
          pi.receivedQty = r3(num(pi.receivedQty) + i.quantity);
        }
        const complete = poItems.every((x) => num(x.receivedQty) >= num(x.quantity) - 1e-9);
        await tx.purchaseOrder.update({ where: { id: po.id }, data: { items: poItems, status: complete ? 'received' : 'partially_received' } });
      }
      return grn;
    });
    activity.record({ userId: actor.id, action: 'goods.received', entityType: 'goods_receipt', entityId: result.id, req });
    if (po?.createdById && po.createdById !== actor.id) {
      notify({ userId: po.createdById, type: 'materials.received', title: 'Goods received', message: `${po.number}: ${items.length} material(s) received`, entityType: 'purchase_order', entityId: po.id });
    }
    return result;
  },

  async listReceipts(query, actor) {
    const where = {};
    if (query.vendorId) where.vendorId = Number(query.vendorId);
    if (query.purchaseOrderId) where.purchaseOrderId = Number(query.purchaseOrderId);
    const allowed = await accessibleProjectIds(actor);
    if (allowed !== null) where.OR = [{ projectId: null }, { projectId: { in: allowed } }];
    const rows = await prisma.goodsReceipt.findMany({ where, orderBy: { id: 'desc' }, take: 300 });
    const pos = await prisma.purchaseOrder.findMany({ where: { id: { in: rows.map((r) => r.purchaseOrderId).filter(Boolean) } }, select: { id: true, number: true } });
    const pm = new Map(pos.map((p) => [p.id, p.number]));
    return (await decorate(rows)).map((r) => ({ ...r, poNumber: pm.get(r.purchaseOrderId) || null }));
  },

  // Last/average purchase rate per material and per vendor (price tracking).
  async prices(query) {
    const where = { type: 'PURCHASE', rate: { not: null } };
    if (query.materialId) where.materialId = Number(query.materialId);
    const rows = await prisma.stockMovement.findMany({ where, orderBy: { date: 'desc' }, take: 2000, select: { materialId: true, vendorId: true, rate: true, quantity: true, date: true } });
    const vendors = await prisma.vendor.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.vendorId).filter(Boolean))] } }, select: { id: true, name: true } });
    const vm = new Map(vendors.map((v) => [v.id, v.name]));
    const byMat = new Map();
    for (const r of rows) {
      const m = byMat.get(r.materialId) || { materialId: r.materialId, last: null, lastDate: null, lastVendor: null, qty: 0, value: 0, min: Infinity, max: 0, history: [] };
      const rate = num(r.rate);
      if (m.last == null) { m.last = rate; m.lastDate = r.date; m.lastVendor = vm.get(r.vendorId) || null; }
      m.qty += num(r.quantity);
      m.value += rate * num(r.quantity);
      m.min = Math.min(m.min, rate);
      m.max = Math.max(m.max, rate);
      if (m.history.length < 12) m.history.push({ date: r.date, rate, vendorName: vm.get(r.vendorId) || null, quantity: num(r.quantity) });
      byMat.set(r.materialId, m);
    }
    return [...byMat.values()].map((m) => ({ ...m, avg: m.qty ? r2(m.value / m.qty) : null, min: m.min === Infinity ? null : m.min }));
  },
};

module.exports = procurement;
