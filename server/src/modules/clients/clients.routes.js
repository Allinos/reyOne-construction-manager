'use strict';

const controller = require('./clients.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { updateClientSchema, listQuery, idParam } = require('./clients.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', authorize('clients.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.get('/:id', authorize('clients.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.patch('/:id', authorize('clients.update'), validate({ params: idParam, body: updateClientSchema }), asyncHandler(controller.update));
}

module.exports = { registerRoutes };
