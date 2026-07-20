'use strict';

const controller = require('./notifications.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');

// Notifications are personal — every authenticated user sees only their own,
// so no extra permission is required beyond being logged in.
function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', asyncHandler(controller.list));
  router.get('/unread-count', asyncHandler(controller.unreadCount));
  router.post('/read-all', asyncHandler(controller.markAllRead));
  router.patch('/:id/read', asyncHandler(controller.markRead));
  router.delete('/:id', asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
