'use strict';

const controller = require('./activity.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { listActivityQuery } = require('./activity.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', authorize('activity.read'), validate({ query: listActivityQuery }), asyncHandler(controller.list));
}

module.exports = { registerRoutes };
