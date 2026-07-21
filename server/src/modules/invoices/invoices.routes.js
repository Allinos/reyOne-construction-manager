'use strict';

const controller = require('./invoices.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const {
  createDocumentSchema,
  updateDocumentSchema,
  listQuery,
  typeQuery,
  idParam,
  configSchema,
} = require('./invoices.validation');

function registerRoutes(router) {
  router.use(authenticate);

  // Config (declared before /documents/:id-style routes; distinct paths anyway)
  router.get('/config', authorize('invoices.read'), asyncHandler(controller.getConfig));
  router.put('/config', authorize('invoices.update'), validate({ body: configSchema }), asyncHandler(controller.updateConfig));

  router.get('/next-number', authorize('invoices.read'), validate({ query: typeQuery }), asyncHandler(controller.nextNumber));

  router.get('/documents', authorize('invoices.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.get('/documents/:id', authorize('invoices.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.post('/documents', authorize('invoices.create'), validate({ body: createDocumentSchema }), asyncHandler(controller.create));
  router.patch('/documents/:id', authorize('invoices.update'), validate({ params: idParam, body: updateDocumentSchema }), asyncHandler(controller.update));
  router.delete('/documents/:id', authorize('invoices.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
