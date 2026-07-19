'use strict';

const service = require('./roles.service');
const { ok, created } = require('../../core/http/response');

const rolesController = {
  async list(req, res) {
    return ok(res, await service.list());
  },
  async listPermissions(req, res) {
    return ok(res, await service.listPermissions());
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

module.exports = rolesController;
