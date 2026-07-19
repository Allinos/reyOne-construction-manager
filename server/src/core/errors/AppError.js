'use strict';

/**
 * Operational error with an HTTP status. Anything thrown that is an AppError
 * is safe to surface to the client; everything else is treated as 500.
 */
class AppError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    if (details) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', details) {
    return new AppError(400, msg, details);
  }
  static unauthorized(msg = 'Unauthorized') {
    return new AppError(401, msg);
  }
  static forbidden(msg = 'Forbidden') {
    return new AppError(403, msg);
  }
  static notFound(msg = 'Not found') {
    return new AppError(404, msg);
  }
  static conflict(msg = 'Conflict') {
    return new AppError(409, msg);
  }
}

module.exports = AppError;
