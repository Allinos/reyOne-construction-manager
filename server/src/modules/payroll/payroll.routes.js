'use strict';

const service = require('./payroll.service');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');
const v = require('./payroll.validation');

const h = (fn) => asyncHandler(fn);

function registerRoutes(router) {
  router.use(authenticate);
  // All salary data is restricted to payroll.read / payroll.manage.
  router.get('/profiles', authorize('payroll.read'), validate({ query: v.typeQuery }), h(async (req, res) => ok(res, await service.profiles(req.query))));
  router.put('/profiles', authorize('payroll.manage'), validate({ body: v.profileSchema }), h(async (req, res) => ok(res, await service.saveProfile(req.body, req.user, req))));
  router.get('/summary', authorize('payroll.read'), validate({ query: v.summaryQuery }), h(async (req, res) => ok(res, await service.summary(req.query))));
  router.get('/ledger', authorize('payroll.read'), validate({ query: v.personQuery }), h(async (req, res) => ok(res, await service.ledger(req.query))));

  router.get('/payments', authorize('payroll.read'), validate({ query: v.paymentsQuery }), h(async (req, res) => {
    const { data, meta } = await service.listPayments(req.query);
    return ok(res, data, meta);
  }));
  router.post('/payments', authorize('payroll.manage'), validate({ body: v.paymentSchema }), h(async (req, res) => created(res, await service.createPayment(req.body, req.user, req))));
  router.delete('/payments/:id', authorize('payroll.manage'), validate({ params: v.idParam }), h(async (req, res) => ok(res, await service.removePayment(req.params.id, req.user, req))));

  router.get('/advances', authorize('payroll.read'), validate({ query: v.advancesQuery }), h(async (req, res) => ok(res, await service.listAdvances(req.query))));
  router.post('/advances', authorize('payroll.manage'), validate({ body: v.advanceSchema }), h(async (req, res) => created(res, await service.createAdvance(req.body, req.user, req))));
  router.delete('/advances/:id', authorize('payroll.manage'), validate({ params: v.idParam }), h(async (req, res) => ok(res, await service.removeAdvance(req.params.id, req.user, req))));
}

module.exports = { registerRoutes };
