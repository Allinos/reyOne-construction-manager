'use strict';

const service = require('./projects.service');
const { ok, created } = require('../../core/http/response');

const projectsController = {
  async list(req, res) {
    const { data, meta } = await service.list(req.query);
    return ok(res, data, meta);
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

  // Phases
  async addPhase(req, res) {
    return created(res, await service.addPhase(req.params.id, req.body, req.user, req));
  },
  async updatePhase(req, res) {
    return ok(res, await service.updatePhase(req.params.id, req.params.phaseId, req.body, req.user, req));
  },
  async removePhase(req, res) {
    return ok(res, await service.removePhase(req.params.id, req.params.phaseId, req.user, req));
  },

  // Tasks
  async addTask(req, res) {
    return created(res, await service.addTask(req.params.id, req.params.phaseId, req.body, req.user, req));
  },
  async updateTask(req, res) {
    return ok(res, await service.updateTask(req.params.id, req.params.phaseId, req.params.taskId, req.body, req.user, req));
  },
  async removeTask(req, res) {
    return ok(res, await service.removeTask(req.params.id, req.params.phaseId, req.params.taskId, req.user, req));
  },
};

module.exports = projectsController;
