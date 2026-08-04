'use strict';

const controller = require('./workforce.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { createWorkforceSchema, updateWorkforceSchema, listQuery, idParam } = require('./workforce.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', authorize('workforce.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.get('/:id', authorize('workforce.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.post('/', authorize('workforce.create'), validate({ body: createWorkforceSchema }), asyncHandler(controller.create));
  router.patch('/:id', authorize('workforce.update'), validate({ params: idParam, body: updateWorkforceSchema }), asyncHandler(controller.update));
  router.delete('/:id', authorize('workforce.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
