'use strict';

const service = require('./vendors.service');
const { ok, created } = require('../../core/http/response');

const vendorsController = {
  async list(req, res) {
    const { data, meta } = await service.list(req.query);
    return ok(res, data, meta);
  },
  async get(req, res) {
    return ok(res, await service.get(req.params.id));
  },
  async ledger(req, res) {
    return ok(res, await service.ledger(req.params.id));
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

module.exports = vendorsController;
