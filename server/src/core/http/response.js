'use strict';

// Standard response envelope used by every endpoint.

function ok(res, data = null, meta = undefined, status = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function created(res, data = null) {
  return ok(res, data, undefined, 201);
}

function fail(res, status, message, details = undefined) {
  const error = { message };
  if (details) error.details = details;
  return res.status(status).json({ success: false, error });
}

module.exports = { ok, created, fail };
