'use strict';

const controller = require('./settings.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const {
  updateCompanySchema,
  upsertSettingSchema,
  groupKeyParams,
  groupParam,
  createFieldDefSchema,
  updateFieldDefSchema,
  idParam,
  entityTypeQuery,
} = require('./settings.validation');

const READ = authorize('settings.read');
const WRITE = authorize('settings.update');

function registerRoutes(router) {
  router.use(authenticate);

  // Database backup download (declared before "/:group").
  router.get('/backup', WRITE, asyncHandler(controller.backup));

  // Company (declared before "/:group" so it isn't treated as a group).
  router.get('/company', READ, asyncHandler(controller.getCompany));
  router.put('/company', WRITE, validate({ body: updateCompanySchema }), asyncHandler(controller.updateCompany));

  // Field definitions (form customizer)
  router.get('/field-definitions', READ, validate({ query: entityTypeQuery }), asyncHandler(controller.listFieldDefs));
  router.post('/field-definitions', WRITE, validate({ body: createFieldDefSchema }), asyncHandler(controller.createFieldDef));
  router.patch(
    '/field-definitions/:id',
    WRITE,
    validate({ params: idParam, body: updateFieldDefSchema }),
    asyncHandler(controller.updateFieldDef),
  );
  router.delete('/field-definitions/:id', WRITE, validate({ params: idParam }), asyncHandler(controller.deleteFieldDef));

  // Generic key/value settings
  router.get('/', READ, asyncHandler(controller.list));
  router.get('/:group', READ, validate({ params: groupParam }), asyncHandler(controller.getGroup));
  router.put(
    '/:group/:key',
    WRITE,
    validate({ params: groupKeyParams, body: upsertSettingSchema }),
    asyncHandler(controller.upsert),
  );
}

module.exports = { registerRoutes };
