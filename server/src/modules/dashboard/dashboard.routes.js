'use strict';

const { insights } = require('./dashboard.insights');
const { ok } = require('../../core/http/response');

const controller = require('./dashboard.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { chartsQuery } = require('./dashboard.validation');

function registerRoutes(router) {
  router.use(authenticate);
  // Role-aware sections (each gated by module + permission inside).
  router.get('/insights', authorize('dashboard.read'), asyncHandler(async (req, res) => ok(res, await insights(req.user))));
  // Company-wide financial summary & charts are finance data.
  router.get('/summary', authorize('finance.read'), asyncHandler(controller.summary));
  router.get('/charts', authorize('finance.read'), validate({ query: chartsQuery }), asyncHandler(controller.charts));
  router.get('/activity', authorize('dashboard.read'), asyncHandler(controller.activity));
}

module.exports = { registerRoutes };
