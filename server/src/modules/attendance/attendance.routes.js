'use strict';

const service = require('./attendance.service');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok } = require('../../core/http/response');
const v = require('./attendance.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/people', authorize('attendance.read', 'payroll.read'), validate({ query: v.peopleQuery }), asyncHandler(async (req, res) => ok(res, await service.people(req.query))));
  router.get('/me', asyncHandler(async (req, res) => ok(res, await service.mine(req.user))));
  router.post('/me/check-in', asyncHandler(async (req, res) => ok(res, await service.punch('in', req.body || {}, req.user, req))));
  router.post('/me/check-out', asyncHandler(async (req, res) => ok(res, await service.punch('out', req.body || {}, req.user, req))));
  router.get('/day', authorize('attendance.read'), validate({ query: v.dayQuery }), asyncHandler(async (req, res) => ok(res, await service.day(req.query))));
  router.put('/day', authorize('attendance.mark'), validate({ body: v.saveDaySchema }), asyncHandler(async (req, res) => ok(res, await service.saveDay(req.body, req.user, req))));
  router.get('/summary', authorize('attendance.read'), validate({ query: v.summaryQuery }), asyncHandler(async (req, res) => ok(res, await service.summary(req.query))));
  router.get('/person', authorize('attendance.read'), validate({ query: v.personQuery }), asyncHandler(async (req, res) => ok(res, await service.person(req.query))));
}

module.exports = { registerRoutes };
