'use strict';

const prisma = require('../../config/prisma');
const { ok } = require('../../core/http/response');

const controller = require('./vendors.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { createVendorSchema, updateVendorSchema, listQuery, idParam } = require('./vendors.validation');
const payables = require('./payables.service');
const { z } = require('zod');

const pid = z.coerce.number().int().positive();
const money = z.coerce.number().positive();
const billSchema = z.object({ amount: money, date: z.coerce.date().optional(), dueDate: z.coerce.date().optional().nullable(), billNumber: z.string().max(60).optional().nullable(), category: z.string().max(80).optional(), projectId: pid.optional().nullable(), purchaseOrderId: pid.optional().nullable(), paidNow: z.coerce.number().nonnegative().optional(), method: z.string().max(50).optional(), account: z.string().max(60).optional(), notes: z.string().max(1000).optional().nullable(), applyAdvance: z.boolean().optional() });
const paySchema = z.object({ amount: money, date: z.coerce.date().optional(), method: z.string().max(50).optional(), account: z.string().max(60).optional(), reference: z.string().max(80).optional().nullable(), notes: z.string().max(1000).optional().nullable(), asAdvance: z.boolean().optional(), allocations: z.array(z.object({ expenseId: pid, amount: money })).max(200).optional() });

function registerRoutes(router) {
  router.use(authenticate);
  // --- payables ---
  router.get('/payables', authorize('vendors.read'), asyncHandler(async (req, res) => ok(res, await payables.summary())));
  router.get('/:id/statement', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await payables.statement(req.params.id))));
  router.post('/:id/bills', authorize('vendors.pay'), validate({ params: idParam, body: billSchema }), asyncHandler(async (req, res) => ok(res, await payables.createBill(req.params.id, req.body, req.user, req))));
  router.post('/:id/payments', authorize('vendors.pay'), validate({ params: idParam, body: paySchema }), asyncHandler(async (req, res) => ok(res, await payables.pay(req.params.id, req.body, req.user, req))));
  router.post('/:id/apply-advance', authorize('vendors.pay'), validate({ params: idParam }), asyncHandler(async (req, res) => ok(res, await payables.applyAdvance(req.params.id, req.user, req))));
  router.delete('/payments/:paymentId', authorize('vendors.pay'), validate({ params: z.object({ paymentId: pid }) }), asyncHandler(async (req, res) => ok(res, await payables.removePayment(req.params.paymentId, req.user, req))));

  router.get('/', authorize('vendors.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.get('/:id', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.get('/:id/ledger', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(controller.ledger));
  // Material purchase history from the inventory ledger.
  router.get('/:id/purchases', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const rows = await prisma.stockMovement.findMany({ where: { vendorId: req.params.id, type: 'PURCHASE' }, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 300 });
    const mats = await prisma.material.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.materialId))] } }, select: { id: true, name: true, unit: true } });
    const projects = await prisma.project.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.projectId).filter(Boolean))] } }, select: { id: true, name: true } });
    const mm = new Map(mats.map((m) => [m.id, m]));
    const pm = new Map(projects.map((p) => [p.id, p.name]));
    const items = rows.map((r) => ({
      id: r.id, date: r.date, materialName: mm.get(r.materialId)?.name, unit: mm.get(r.materialId)?.unit,
      quantity: Number(r.quantity), rate: r.rate != null ? Number(r.rate) : null,
      value: r.rate != null ? Math.round(Number(r.quantity) * Number(r.rate) * 100) / 100 : null,
      location: r.projectId ? pm.get(r.projectId) || `#${r.projectId}` : 'Central Store', notes: r.notes,
    }));
    return ok(res, { items, totalValue: Math.round(items.reduce((s, i) => s + (i.value || 0), 0) * 100) / 100 });
  }));
  router.post('/', authorize('vendors.create'), validate({ body: createVendorSchema }), asyncHandler(controller.create));
  router.patch('/:id', authorize('vendors.update'), validate({ params: idParam, body: updateVendorSchema }), asyncHandler(controller.update));
  router.delete('/:id', authorize('vendors.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
