'use strict';

const service = require('./modules.service');
const { ok } = require('../../core/http/response');

const modulesController = {
  async list(req, res) {
    return ok(res, await service.list());
  },
  async toggle(req, res) {
    return ok(res, await service.toggle(req.params.key, req.body.enabled, req.user, req));
  },
};

module.exports = modulesController;
