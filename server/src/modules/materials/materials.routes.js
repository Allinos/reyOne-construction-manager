'use strict';

const service = require('./materials.service');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');
const v = require('./materials.validation');
const procurement = require('./procurement.service');
const { z } = require('zod');

const pid = z.coerce.number().int().positive();
const poLine = z.object({ materialId: pid, quantity: z.coerce.number().positive(), rate: z.coerce.number().nonnegative().optional() });
const pv = {
  poQuery: z.object({ status: z.string().max(30).optional(), vendorId: pid.optional(), projectId: z.union([z.literal('store'), z.string().regex(/^\d+$/)]).optional() }),
  poCreate: z.object({ vendorId: pid, projectId: pid.optional().nullable(), requestId: pid.optional().nullable(), status: z.enum(['draft', 'ordered']).optional(), orderDate: z.coerce.date().optional(), expectedDate: z.coerce.date().optional().nullable(), items: z.array(poLine).min(1).max(100), taxPercent: z.coerce.number().min(0).max(100).optional(), notes: z.string().max(3000).optional().nullable(), terms: z.string().max(5000).optional().nullable() }),
  poUpdate: z.object({ vendorId: pid.optional(), projectId: pid.optional().nullable(), status: z.enum(['draft', 'ordered', 'received', 'cancelled']).optional(), orderDate: z.coerce.date().optional(), expectedDate: z.coerce.date().optional().nullable(), items: z.array(poLine).min(1).max(100).optional(), taxPercent: z.coerce.number().min(0).max(100).optional(), notes: z.string().max(3000).optional().nullable(), terms: z.string().max(5000).optional().nullable() }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
  receive: z.object({ purchaseOrderId: pid.optional(), vendorId: pid.optional().nullable(), projectId: pid.optional().nullable(), date: z.coerce.date().optional(), items: z.array(z.object({ materialId: pid, quantity: z.coerce.number().nonnegative(), rate: z.coerce.number().nonnegative().optional() })).min(1).max(100), billNumber: z.string().max(60).optional().nullable(), dueDate: z.coerce.date().optional().nullable(), taxPercent: z.coerce.number().min(0).max(100).optional(), recordBill: z.boolean().optional(), paidNow: z.boolean().optional(), method: z.string().max(50).optional(), account: z.string().max(60).optional(), notes: z.string().max(1000).optional().nullable() }),
  receiptsQuery: z.object({ vendorId: pid.optional(), purchaseOrderId: pid.optional() }),
  pricesQuery: z.object({ materialId: pid.optional() }),
};

const h = (fn) => asyncHandler(fn);

function registerRoutes(router) {
  router.use(authenticate);
  const read = authorize('materials.read');
  const manage = authorize('materials.manage');

  router.get('/analytics', read, h(async (req, res) => ok(res, await service.analytics(req.user))));

  router.get('/items', read, validate({ query: v.itemsQuery }), h(async (req, res) => ok(res, await service.listItems(req.query))));
  router.get('/items/:id/locations', read, validate({ params: v.idParam }), h(async (req, res) => ok(res, await service.locations(req.params.id, req.user))));
  router.post('/items', manage, validate({ body: v.itemSchema }), h(async (req, res) => created(res, await service.createItem(req.body, req.user, req))));
  router.patch('/items/:id', manage, validate({ params: v.idParam, body: v.itemUpdateSchema }), h(async (req, res) => ok(res, await service.updateItem(req.params.id, req.body, req.user, req))));
  router.delete('/items/:id', manage, validate({ params: v.idParam }), h(async (req, res) => ok(res, await service.removeItem(req.params.id, req.user, req))));

  router.get('/stock', read, validate({ query: v.stockQuery }), h(async (req, res) => ok(res, await service.stock(req.query, req.user))));
  router.get('/movements', read, validate({ query: v.movementsQuery }), h(async (req, res) => {
    const { data, meta } = await service.movements(req.query, req.user);
    return ok(res, data, meta);
  }));
  router.get('/consumption', read, validate({ query: v.consumptionQuery }), h(async (req, res) => ok(res, await service.consumption(req.query, req.user))));

  router.post('/purchase', manage, validate({ body: v.purchaseSchema }), h(async (req, res) => created(res, await service.purchase(req.body, req.user, req))));
  router.post('/transfer', manage, validate({ body: v.transferSchema }), h(async (req, res) => ok(res, await service.transfer(req.body, req.user, req))));
  router.post('/consume', authorize('materials.request', 'materials.manage'), validate({ body: v.consumeSchema }), h(async (req, res) => ok(res, await service.consume(req.body, req.user, req))));
  router.post('/return', authorize('materials.request', 'materials.manage'), validate({ body: v.returnSchema }), h(async (req, res) => ok(res, await service.returnToStore(req.body, req.user, req))));
  router.post('/wastage', authorize('materials.request', 'materials.manage'), validate({ body: v.wastageSchema }), h(async (req, res) => ok(res, await service.wastage(req.body, req.user, req))));
  router.post('/adjust', manage, validate({ body: v.adjustSchema }), h(async (req, res) => ok(res, await service.adjust(req.body, req.user, req))));

  router.get('/requests', read, validate({ query: v.requestsQuery }), h(async (req, res) => ok(res, await service.listRequests(req.query, req.user))));
  router.post('/requests', authorize('materials.request', 'materials.manage'), validate({ body: v.requestSchema }), h(async (req, res) => created(res, await service.createRequest(req.body, req.user, req))));
  router.patch('/requests/:id/decide', authorize('materials.approve'), validate({ params: v.idParam, body: v.decideSchema }), h(async (req, res) => ok(res, await service.decideRequest(req.params.id, req.body, req.user, req))));
  // --- procurement ---
  router.get('/purchase-orders', read, validate({ query: pv.poQuery }), h(async (req, res) => ok(res, await procurement.listPOs(req.query, req.user))));
  router.post('/purchase-orders', manage, validate({ body: pv.poCreate }), h(async (req, res) => created(res, await procurement.createPO(req.body, req.user, req))));
  router.get('/purchase-orders/:id', read, validate({ params: v.idParam }), h(async (req, res) => ok(res, await procurement.getPO(req.params.id, req.user))));
  router.patch('/purchase-orders/:id', manage, validate({ params: v.idParam, body: pv.poUpdate }), h(async (req, res) => ok(res, await procurement.updatePO(req.params.id, req.body, req.user, req))));
  router.delete('/purchase-orders/:id', manage, validate({ params: v.idParam }), h(async (req, res) => ok(res, await procurement.removePO(req.params.id, req.user, req))));
  router.get('/receipts', read, validate({ query: pv.receiptsQuery }), h(async (req, res) => ok(res, await procurement.listReceipts(req.query, req.user))));
  router.post('/receipts', manage, validate({ body: pv.receive }), h(async (req, res) => created(res, await procurement.receive(req.body, req.user, req))));
  router.get('/prices', read, validate({ query: pv.pricesQuery }), h(async (req, res) => ok(res, await procurement.prices(req.query))));

  router.post('/requests/:id/fulfill', manage, validate({ params: v.idParam, body: v.fulfillSchema }), h(async (req, res) => ok(res, await service.fulfillRequest(req.params.id, req.body, req.user, req))));
}

module.exports = { registerRoutes };
