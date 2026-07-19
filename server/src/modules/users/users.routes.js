'use strict';

const controller = require('./users.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  listUsersQuery,
  idParam,
} = require('./users.validation');

function registerRoutes(router) {
  router.use(authenticate);

  router.get('/', authorize('users.read'), validate({ query: listUsersQuery }), asyncHandler(controller.list));
  router.get('/:id', authorize('users.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.post('/', authorize('users.create'), validate({ body: createUserSchema }), asyncHandler(controller.create));
  router.patch(
    '/:id',
    authorize('users.update'),
    validate({ params: idParam, body: updateUserSchema }),
    asyncHandler(controller.update),
  );
  router.delete('/:id', authorize('users.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
  router.post(
    '/:id/reset-password',
    authorize('users.update'),
    validate({ params: idParam, body: resetPasswordSchema }),
    asyncHandler(controller.resetPassword),
  );
}

module.exports = { registerRoutes };
