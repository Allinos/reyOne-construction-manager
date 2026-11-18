'use strict';

const service = require('./materials.service');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');
const v = require('./materials.validation');

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
  router.post('/adjust', manage, validate({ body: v.adjustSchema }), h(async (req, res) => ok(res, await service.adjust(req.body, req.user, req))));

  router.get('/requests', read, validate({ query: v.requestsQuery }), h(async (req, res) => ok(res, await service.listRequests(req.query, req.user))));
  router.post('/requests', authorize('materials.request', 'materials.manage'), validate({ body: v.requestSchema }), h(async (req, res) => created(res, await service.createRequest(req.body, req.user, req))));
  router.patch('/requests/:id/decide', authorize('materials.approve'), validate({ params: v.idParam, body: v.decideSchema }), h(async (req, res) => ok(res, await service.decideRequest(req.params.id, req.body, req.user, req))));
  router.post('/requests/:id/fulfill', manage, validate({ params: v.idParam, body: v.fulfillSchema }), h(async (req, res) => ok(res, await service.fulfillRequest(req.params.id, req.body, req.user, req))));
}

module.exports = { registerRoutes };
