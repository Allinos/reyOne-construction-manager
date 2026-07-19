'use strict';

const service = require('./activity.service');
const { ok } = require('../../core/http/response');

const activityController = {
  async list(req, res) {
    const { data, meta } = await service.list(req.query);
    return ok(res, data, meta);
  },
};

module.exports = activityController;
