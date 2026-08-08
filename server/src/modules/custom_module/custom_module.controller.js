'use strict';

const service = require('./custom_module.service');
const { ok, created } = require('../../core/http/response');

const customModuleController = {
  async list(req, res) {
    const { data, meta } = await service.listRecords(req.query);
    return ok(res, data, meta);
  },
  async create(req, res) {
    return created(res, await service.createRecord(req.body, req.user, req));
  },
  async update(req, res) {
    return ok(res, await service.updateRecord(req.params.id, req.body, req.user, req));
  },
  async remove(req, res) {
    return ok(res, await service.removeRecord(req.params.id, req.user, req));
  },
  async getConfig(req, res) {
    return ok(res, await service.getConfig());
  },
  async setConfig(req, res) {
    return ok(res, await service.setConfig(req.body, req.user, req));
  },
  async analytics(req, res) {
    return ok(res, await service.analytics());
  },
};

module.exports = customModuleController;
