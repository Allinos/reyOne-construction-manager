'use strict';

const { Prisma } = require('@prisma/client');
const repo = require('./invoices.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const D = (v) => new Prisma.Decimal(v ?? 0);

// Computes normalized line items and totals (server-side is source of truth).
// GST template applies a per-item GST rate; standard applies one global rate.
function computeTotals(items, taxRate, template) {
  if (template === 'gst') {
    let subtotal = D(0);
    let taxTotal = D(0);
    const normItems = items.map((it) => {
      const line = D(it.quantity).times(D(it.unitPrice));
      const rate = D(it.gstRate ?? 0);
      const tax = line.times(rate).div(100);
      subtotal = subtotal.plus(line);
      taxTotal = taxTotal.plus(tax);
      return {
        description: it.description,
        hsnCode: it.hsnCode || '',
        quantity: Number(it.quantity),
        unitPrice: D(it.unitPrice).toFixed(2),
        gstRate: rate.toFixed(2),
        taxAmount: tax.toFixed(2),
        total: line.plus(tax).toFixed(2),
      };
    });
    return {
      items: normItems,
      subtotal: subtotal.toFixed(2),
      taxRate: '0.00',
      taxAmount: taxTotal.toFixed(2),
      total: subtotal.plus(taxTotal).toFixed(2),
    };
  }

  let subtotal = D(0);
  const normItems = items.map((it) => {
    const line = D(it.quantity).times(D(it.unitPrice));
    subtotal = subtotal.plus(line);
    return {
      description: it.description,
      quantity: Number(it.quantity),
      unitPrice: D(it.unitPrice).toFixed(2),
      total: line.toFixed(2),
    };
  });
  const rate = D(taxRate ?? 0);
  const taxAmount = subtotal.times(rate).div(100);
  return {
    items: normItems,
    subtotal: subtotal.toFixed(2),
    taxRate: rate.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: subtotal.plus(taxAmount).toFixed(2),
  };
}

async function prefixFor(type) {
  const key = type === 'QUOTATION' ? 'quotation_prefix' : 'invoice_prefix';
  const row = await repo.getSetting(key);
  return (row && row.value) || (type === 'QUOTATION' ? 'QTN-' : 'INV-');
}

async function generateNumber(type) {
  const prefix = await prefixFor(type);
  let n = (await repo.countByType(type)) + 1;
  for (let i = 0; i < 5; i += 1) {
    const candidate = `${prefix}${String(n).padStart(4, '0')}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await repo.findByNumber(type, candidate))) return candidate;
    n += 1;
  }
  return `${prefix}${Date.now()}`;
}

const invoicesService = {
  async list(query) {
    const { page, limit, skip, take } = getPagination(query);
    const where = { deletedAt: null };
    if (query.type) where.type = query.type;
    if (query.search) {
      where.OR = [{ number: { contains: query.search } }, { clientName: { contains: query.search } }];
    }
    const { rows, total } = await repo.list({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async get(id) {
    const doc = await repo.findById(id);
    if (!doc) throw AppError.notFound('Document not found');
    return doc;
  },

  async nextNumber(type) {
    return { number: await generateNumber(type) };
  },

  async create(payload, actor, req) {
    const template = payload.template || 'standard';
    const totals = computeTotals(payload.items, payload.taxRate, template);
    const number = payload.number || (await generateNumber(payload.type));
    if (payload.number && (await repo.findByNumber(payload.type, number))) {
      throw AppError.conflict('A document with this number already exists');
    }
    const doc = await repo.create({
      type: payload.type,
      template,
      number,
      projectId: payload.projectId ?? null,
      clientName: payload.clientName,
      clientPhone: payload.clientPhone,
      clientEmail: payload.clientEmail || null,
      clientAddress: payload.clientAddress,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate ?? null,
      items: totals.items,
      subtotal: totals.subtotal,
      taxRate: totals.taxRate,
      taxAmount: totals.taxAmount,
      total: totals.total,
      status: payload.status || (payload.type === 'INVOICE' ? 'unpaid' : 'draft'),
      notes: payload.notes,
      terms: payload.terms,
      createdById: actor.id,
    });
    activity.record({ userId: actor.id, action: 'billing.created', entityType: 'billing', entityId: doc.id, req });
    return doc;
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Document not found');

    const data = { ...payload };
    if (data.clientEmail === '') data.clientEmail = null;
    if (payload.items) {
      const template = payload.template || existing.template || 'standard';
      const totals = computeTotals(payload.items, payload.taxRate ?? existing.taxRate, template);
      data.template = template;
      data.items = totals.items;
      data.subtotal = totals.subtotal;
      data.taxRate = totals.taxRate;
      data.taxAmount = totals.taxAmount;
      data.total = totals.total;
    }
    const doc = await repo.update(id, data);
    activity.record({ userId: actor.id, action: 'billing.updated', entityType: 'billing', entityId: id, req });
    return doc;
  },

  async remove(id, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Document not found');
    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'billing.deleted', entityType: 'billing', entityId: id, req });
    return { success: true };
  },

  async getConfig() {
    const row = await repo.getSetting('config');
    return row ? row.value : {};
  },
  async updateConfig(value, actor, req) {
    const row = await repo.upsertSetting('config', value);
    activity.record({ userId: actor.id, action: 'billing.config_updated', entityType: 'setting', entityId: 'invoices.config', req });
    return row.value;
  },
};

module.exports = invoicesService;
