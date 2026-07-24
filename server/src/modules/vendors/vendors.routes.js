'use strict';

const controller = require('./vendors.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { createVendorSchema, updateVendorSchema, listQuery, idParam } = require('./vendors.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', authorize('vendors.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.get('/:id', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.get('/:id/ledger', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(controller.ledger));
  router.post('/', authorize('vendors.create'), validate({ body: createVendorSchema }), asyncHandler(controller.create));
  router.patch('/:id', authorize('vendors.update'), validate({ params: idParam, body: updateVendorSchema }), asyncHandler(controller.update));
  router.delete('/:id', authorize('vendors.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
