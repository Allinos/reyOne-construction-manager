'use strict';

const AppError = require('../errors/AppError');

const WILDCARD = '*';

/**
 * Guards a route by permission key(s). A user passes if they hold the wildcard
 * "*" (Owner) or any of the required permission keys.
 *   authorize('projects.create')
 *   authorize('projects.update', 'projects.manage')
 */
const authorize =
  (...required) =>
  (req, _res, next) => {
    const perms = req.user?.permissions || [];
    if (perms.includes(WILDCARD)) return next();
    const allowed = required.some((key) => perms.includes(key));
    if (!allowed) return next(AppError.forbidden('You do not have permission to do this'));
    next();
  };

module.exports = authorize;
