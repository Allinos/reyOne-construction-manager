'use strict';

const controller = require('./documents.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const {
  createDocumentSchema,
  updateDocumentSchema,
  previewSchema,
  listQuery,
  idParam,
  keyParam,
} = require('./documents.validation');

function registerRoutes(router) {
  router.use(authenticate);

  // Template library (static paths before "/:id").
  router.get('/templates', authorize('documents.read'), asyncHandler(controller.catalog));
  router.get('/templates/:key', authorize('documents.read'), validate({ params: keyParam }), asyncHandler(controller.template));

  // Live preview of arbitrary data (create flow / gallery).
  router.post('/preview', authorize('documents.read'), validate({ body: previewSchema }), asyncHandler(controller.preview));

  // Saved documents.
  router.get('/', authorize('documents.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.post('/', authorize('documents.create'), validate({ body: createDocumentSchema }), asyncHandler(controller.create));
  router.get('/:id', authorize('documents.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.get('/:id/render', authorize('documents.read'), validate({ params: idParam }), asyncHandler(controller.render));
  router.patch('/:id', authorize('documents.update'), validate({ params: idParam, body: updateDocumentSchema }), asyncHandler(controller.update));
  router.delete('/:id', authorize('documents.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
