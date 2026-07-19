'use strict';

const service = require('./settings.service');
const { ok, created } = require('../../core/http/response');

const settingsController = {
  // Company
  async getCompany(req, res) {
    return ok(res, await service.getCompany());
  },
  async updateCompany(req, res) {
    return ok(res, await service.updateCompany(req.body, req.user, req));
  },

  // Generic settings
  async list(req, res) {
    return ok(res, await service.list());
  },
  async getGroup(req, res) {
    return ok(res, await service.getGroup(req.params.group));
  },
  async upsert(req, res) {
    return ok(res, await service.upsert(req.params.group, req.params.key, req.body.value, req.user, req));
  },

  // Field definitions
  async listFieldDefs(req, res) {
    return ok(res, await service.listFieldDefs(req.query.entityType));
  },
  async createFieldDef(req, res) {
    return created(res, await service.createFieldDef(req.body, req.user, req));
  },
  async updateFieldDef(req, res) {
    return ok(res, await service.updateFieldDef(req.params.id, req.body, req.user, req));
  },
  async deleteFieldDef(req, res) {
    return ok(res, await service.deleteFieldDef(req.params.id, req.user, req));
  },
};

module.exports = settingsController;
