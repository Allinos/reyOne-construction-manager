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

  // --- Security: active sessions and "sign out everyone" ---
  router.get('/security/sessions', WRITE, asyncHandler(async (req, res) => {
    const prisma = require('../../config/prisma');
    const rows = await prisma.refreshToken.groupBy({ by: ['userId'], where: { revokedAt: null, expiresAt: { gt: new Date() } }, _count: { _all: true }, _max: { createdAt: true } });
    const users = await prisma.user.findMany({ where: { id: { in: rows.map((r) => r.userId) } }, select: { id: true, name: true, email: true, lastLoginAt: true, role: { select: { name: true } } } });
    const um = new Map(users.map((u) => [u.id, u]));
    res.json({ success: true, data: rows.map((r) => ({ userId: r.userId, name: um.get(r.userId)?.name, email: um.get(r.userId)?.email, role: um.get(r.userId)?.role?.name, sessions: r._count._all, lastLoginAt: um.get(r.userId)?.lastLoginAt })).sort((a, b) => b.sessions - a.sessions) });
  }));
  router.post('/security/sign-out-all', WRITE, asyncHandler(async (req, res) => {
    const prisma = require('../../config/prisma');
    const activity = require('../../core/services/activityLog');
    // Everyone except the admin doing it must sign in again.
    const r = await prisma.refreshToken.updateMany({ where: { revokedAt: null, userId: { not: req.user.id } }, data: { revokedAt: new Date() } });
    activity.record({ userId: req.user.id, action: 'security.sign_out_all', entityType: 'setting', entityId: 'security', req });
    res.json({ success: true, data: { revoked: r.count } });
  }));

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
