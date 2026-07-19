'use strict';

const AppError = require('../errors/AppError');

/**
 * Validates parts of the request against Zod schemas and replaces them with
 * the parsed (coerced) values. Usage: validate({ body: schema, query: schema })
 */
const validate = (schemas) => (req, _res, next) => {
  try {
    for (const key of ['body', 'query', 'params']) {
      if (schemas[key]) {
        req[key] = schemas[key].parse(req[key]);
      }
    }
    next();
  } catch (err) {
    if (err.issues) {
      const details = err.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(AppError.badRequest('Validation failed', details));
    }
    next(err);
  }
};

module.exports = validate;
