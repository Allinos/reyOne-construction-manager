'use strict';

const { z } = require('zod');
const prisma = require('../../config/prisma');
const validate = require('../../core/middleware/validate');
const { ok } = require('../../core/http/response');
const push = require('../../core/services/push');

const deviceSchema = z.object({ token: z.string().min(10).max(512), platform: z.enum(['android', 'ios']).optional() });

const controller = require('./notifications.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');

// Notifications are personal — every authenticated user sees only their own,
// so no extra permission is required beyond being logged in.
function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', asyncHandler(controller.list));
  // Mobile push: register / unregister this device's FCM token.
  router.post('/devices', validate({ body: deviceSchema }), asyncHandler(async (req, res) => {
    const row = await prisma.deviceToken.upsert({
      where: { token: req.body.token },
      update: { userId: req.user.id, platform: req.body.platform || 'android', lastSeenAt: new Date() },
      create: { userId: req.user.id, token: req.body.token, platform: req.body.platform || 'android' },
    });
    return ok(res, { id: row.id, pushConfigured: push.isConfigured() });
  }));
  router.delete('/devices', validate({ body: z.object({ token: z.string().min(10).max(512) }) }), asyncHandler(async (req, res) => {
    await prisma.deviceToken.deleteMany({ where: { token: req.body.token, userId: req.user.id } });
    return ok(res, { success: true });
  }));
  router.get('/unread-count', asyncHandler(controller.unreadCount));
  router.post('/read-all', asyncHandler(controller.markAllRead));
  router.patch('/:id/read', asyncHandler(controller.markRead));
  router.delete('/:id', asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
