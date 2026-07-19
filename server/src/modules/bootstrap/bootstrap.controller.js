'use strict';

const service = require('./bootstrap.service');
const { ok } = require('../../core/http/response');

const bootstrapController = {
  async get(req, res) {
    return ok(res, await service.build(req.user));
  },
};

module.exports = bootstrapController;
