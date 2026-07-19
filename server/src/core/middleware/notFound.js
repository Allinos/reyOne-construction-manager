'use strict';

const { fail } = require('../http/response');

// Any route not mounted (including disabled modules) lands here.
const notFound = (req, res) => fail(res, 404, `Route not found: ${req.method} ${req.originalUrl}`);

module.exports = notFound;
