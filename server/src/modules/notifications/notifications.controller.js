'use strict';

const service = require('./notifications.service');
const { ok } = require('../../core/http/response');

const notificationsController = {
  async list(req, res) {
    const { data, meta } = await service.list(req.user.id, req.query);
    return ok(res, data, meta);
  },
  async unreadCount(req, res) {
    return ok(res, await service.unreadCount(req.user.id));
  },
  async markRead(req, res) {
    return ok(res, await service.markRead(Number(req.params.id), req.user.id));
  },
  async markAllRead(req, res) {
    return ok(res, await service.markAllRead(req.user.id));
  },
  async remove(req, res) {
    return ok(res, await service.remove(Number(req.params.id), req.user.id));
  },
};

module.exports = notificationsController;
