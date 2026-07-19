'use strict';

const controller = require('./roles.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { createRoleSchema, updateRoleSchema, idParam } = require('./roles.validation');

function registerRoutes(router) {
  router.use(authenticate);

  // Permission catalog — declared before "/:id" so it isn't swallowed by it.
  router.get('/permissions', authorize('roles.read'), asyncHandler(controller.listPermissions));

  router.get('/', authorize('roles.read'), asyncHandler(controller.list));
  router.get('/:id', authorize('roles.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.post('/', authorize('roles.create'), validate({ body: createRoleSchema }), asyncHandler(controller.create));
  router.patch(
    '/:id',
    authorize('roles.update'),
    validate({ params: idParam, body: updateRoleSchema }),
    asyncHandler(controller.update),
  );
  router.delete('/:id', authorize('roles.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
