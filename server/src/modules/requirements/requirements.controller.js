'use strict';

const service = require('./requirements.service');
const { ok, created } = require('../../core/http/response');

const requirementsController = {
  async list(req, res) {
    return ok(res, await service.listRequirements(req.query));
  },
  async create(req, res) {
    return created(res, await service.createRequirement(req.body, req.user, req));
  },
  async update(req, res) {
    return ok(res, await service.updateRequirement(req.params.id, req.body, req.user, req));
  },
  async remove(req, res) {
    return ok(res, await service.removeRequirement(req.params.id, req.user, req));
  },

  async listPhotos(req, res) {
    return ok(res, await service.listPhotos(req.query));
  },
  async createPhoto(req, res) {
    return created(res, await service.createPhoto(req.body, req.user, req));
  },
  async removePhoto(req, res) {
    return ok(res, await service.removePhoto(req.params.id, req.user, req));
  },
};

module.exports = requirementsController;
