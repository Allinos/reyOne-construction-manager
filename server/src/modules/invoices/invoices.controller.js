'use strict';

const service = require('./invoices.service');
const { ok, created } = require('../../core/http/response');

const invoicesController = {
  async list(req, res) {
    const { data, meta } = await service.list(req.query);
    return ok(res, data, meta);
  },
  async get(req, res) {
    return ok(res, await service.get(req.params.id));
  },
  async nextNumber(req, res) {
    return ok(res, await service.nextNumber(req.query.type));
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
  async getConfig(req, res) {
    return ok(res, await service.getConfig());
  },
  async updateConfig(req, res) {
    return ok(res, await service.updateConfig(req.body.value, req.user, req));
  },
};

module.exports = invoicesController;
