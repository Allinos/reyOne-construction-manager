'use strict';

const controller = require('./dashboard.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { chartsQuery } = require('./dashboard.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/summary', authorize('dashboard.read'), asyncHandler(controller.summary));
  router.get('/charts', authorize('dashboard.read'), validate({ query: chartsQuery }), asyncHandler(controller.charts));
  router.get('/activity', authorize('dashboard.read'), asyncHandler(controller.activity));
}

module.exports = { registerRoutes };
