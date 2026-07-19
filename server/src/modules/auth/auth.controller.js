'use strict';

const service = require('./auth.service');
const { ok } = require('../../core/http/response');

const authController = {
  async login(req, res) {
    const result = await service.login(req.body.email, req.body.password, req);
    return ok(res, result);
  },

  async refresh(req, res) {
    const result = await service.refresh(req.body.refreshToken);
    return ok(res, result);
  },

  async logout(req, res) {
    const result = await service.logout(req.body.refreshToken);
    return ok(res, result);
  },

  async me(req, res) {
    const result = await service.me(req.user.id);
    return ok(res, result);
  },

  async changePassword(req, res) {
    const result = await service.changePassword(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword,
      req,
    );
    return ok(res, result);
  },
};

module.exports = authController;
