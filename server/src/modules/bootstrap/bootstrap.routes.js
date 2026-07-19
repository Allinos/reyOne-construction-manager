'use strict';

const controller = require('./bootstrap.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');

function registerRoutes(router) {
  // Any authenticated user may bootstrap; the payload is scoped to their access.
  router.get('/', authenticate, asyncHandler(controller.get));
}

module.exports = { registerRoutes };
