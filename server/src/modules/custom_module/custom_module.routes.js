'use strict';

const controller = require('./custom_module.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { createRecordSchema, updateRecordSchema, listQuery, configSchema, idParam } = require('./custom_module.validation');

function registerRoutes(router) {
  router.use(authenticate);

  // Config (form builder + list visibility)
  router.get('/config', authorize('custom_module.read'), asyncHandler(controller.getConfig));
  router.put('/config', authorize('custom_module.configure'), validate({ body: configSchema }), asyncHandler(controller.setConfig));

  // Analytics
  router.get('/analytics', authorize('custom_module.read'), asyncHandler(controller.analytics));

  // Records
  router.get('/records', authorize('custom_module.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.post('/records', authorize('custom_module.create'), validate({ body: createRecordSchema }), asyncHandler(controller.create));
  router.patch('/records/:id', authorize('custom_module.update'), validate({ params: idParam, body: updateRecordSchema }), asyncHandler(controller.update));
  router.delete('/records/:id', authorize('custom_module.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
