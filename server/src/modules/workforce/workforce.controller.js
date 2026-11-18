'use strict';

const service = require('./workforce.service');
const { ok, created } = require('../../core/http/response');

const workforceController = {
  async list(req, res) {
    const { data, meta } = await service.list(req.query, req.user);
    return ok(res, data, meta);
  },
  async overview(req, res) {
    return ok(res, await service.overview(req.params.id, req.user));
  },
  async stats(req, res) {
    return ok(res, await service.stats(req.user));
  },
  async get(req, res) {
    return ok(res, await service.get(req.params.id));
  },
  async create(req, res) {
    return created(res, await service.create(req.body, req.user, req));
  },
  async update(req, res) {
    return ok(res, await service.update(req.params.id, req.body, req.user, req));
  },
  async remove(req, res) {
    return ok(res, await service.remove(req.params.id, req.user, req));
  },
};

module.exports = workforceController;
