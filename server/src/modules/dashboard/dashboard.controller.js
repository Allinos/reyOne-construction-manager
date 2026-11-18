'use strict';

const service = require('./dashboard.service');
const { ok } = require('../../core/http/response');

const dashboardController = {
  async summary(req, res) {
    return ok(res, await service.summary());
  },
  async charts(req, res) {
    return ok(res, await service.charts(req.query));
  },
  async activity(req, res) {
    return ok(res, await service.activity(req.user));
  },
};

module.exports = dashboardController;
