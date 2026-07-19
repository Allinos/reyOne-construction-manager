'use strict';

const controller = require('./modules.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { keyParam, toggleSchema } = require('./modules.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', authorize('modules.read'), asyncHandler(controller.list));
  router.patch(
    '/:key',
    authorize('modules.update'),
    validate({ params: keyParam, body: toggleSchema }),
    asyncHandler(controller.toggle),
  );
}

module.exports = { registerRoutes };
