'use strict';

const service = require('./documents.service');
const { ok, created } = require('../../core/http/response');

const documentsController = {
  async catalog(req, res) {
    return ok(res, service.catalog());
  },
  async template(req, res) {
    return ok(res, service.template(req.params.key));
  },
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
  async render(req, res) {
    return ok(res, await service.render(req.params.id));
  },
  async preview(req, res) {
    return ok(res, await service.preview(req.body.templateKey, req.body.data));
  },
};

module.exports = documentsController;
