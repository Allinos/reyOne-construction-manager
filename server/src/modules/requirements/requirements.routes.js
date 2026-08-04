'use strict';

const controller = require('./requirements.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const {
  createRequirementSchema,
  updateRequirementSchema,
  listQuery,
  createPhotoSchema,
  photoQuery,
  idParam,
} = require('./requirements.validation');

function registerRoutes(router) {
  router.use(authenticate);

  // Photos (declared before /:id so the literal path is not swallowed).
  router.get('/photos', authorize('requirements.read'), validate({ query: photoQuery }), asyncHandler(controller.listPhotos));
  router.post('/photos', authorize('requirements.update'), validate({ body: createPhotoSchema }), asyncHandler(controller.createPhoto));
  router.delete('/photos/:id', authorize('requirements.update'), validate({ params: idParam }), asyncHandler(controller.removePhoto));

  // Requirements (TEXT | FORM | TABLE).
  router.get('/', authorize('requirements.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.post('/', authorize('requirements.update'), validate({ body: createRequirementSchema }), asyncHandler(controller.create));
  router.patch('/:id', authorize('requirements.update'), validate({ params: idParam, body: updateRequirementSchema }), asyncHandler(controller.update));
  router.delete('/:id', authorize('requirements.update'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
