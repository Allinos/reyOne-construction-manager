'use strict';

const env = require('../../config/env');
const AppError = require('../errors/AppError');
const { fail } = require('../http/response');

// Maps common Prisma errors to friendly HTTP responses.
function mapPrismaError(err) {
  if (err.code === 'P2002') {
    const field = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'field';
    return AppError.conflict(`A record with this ${field} already exists`);
  }
  if (err.code === 'P2025') return AppError.notFound('Record not found');
  if (err.code === 'P2003') return AppError.badRequest('Related record does not exist');
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(error instanceof AppError)) {
    const mapped = mapPrismaError(error);
    if (mapped) error = mapped;
  }

  if (error instanceof AppError) {
    return fail(res, error.statusCode, error.message, error.details);
  }

  if (!env.isProd) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
  return fail(res, 500, 'Internal server error');
}

module.exports = errorHandler;
