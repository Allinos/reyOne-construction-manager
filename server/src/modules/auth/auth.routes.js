'use strict';

const rateLimit = require('express-rate-limit');
const controller = require('./auth.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const validate = require('../../core/middleware/validate');
const authenticate = require('../../core/middleware/authenticate');
const { loginSchema, refreshSchema, changePasswordSchema } = require('./auth.validation');

// Throttle credential endpoints to blunt brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts, try again later' } },
});

function registerRoutes(router) {
  router.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(controller.login));
  router.post('/refresh', validate({ body: refreshSchema }), asyncHandler(controller.refresh));
  router.post('/logout', validate({ body: refreshSchema }), asyncHandler(controller.logout));
  router.get('/me', authenticate, asyncHandler(controller.me));
  router.post(
    '/change-password',
    authenticate,
    validate({ body: changePasswordSchema }),
    asyncHandler(controller.changePassword),
  );
}

module.exports = { registerRoutes };
