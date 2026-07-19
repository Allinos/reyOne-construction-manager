'use strict';

const service = require('./finance.service');
const { ok, created } = require('../../core/http/response');

const financeController = {
  // Payments
  async listPayments(req, res) {
    const { data, meta } = await service.listPayments(req.query);
    return ok(res, data, meta);
  },
  async createPayment(req, res) {
    return created(res, await service.createPayment(req.body, req.user, req));
  },
  async updatePayment(req, res) {
    return ok(res, await service.updatePayment(req.params.id, req.body, req.user, req));
  },
  async deletePayment(req, res) {
    return ok(res, await service.deletePayment(req.params.id, req.user, req));
  },

  // Expenses
  async listExpenses(req, res) {
    const { data, meta } = await service.listExpenses(req.query);
    return ok(res, data, meta);
  },
  async createExpense(req, res) {
    return created(res, await service.createExpense(req.body, req.user, req));
  },
  async updateExpense(req, res) {
    return ok(res, await service.updateExpense(req.params.id, req.body, req.user, req));
  },
  async deleteExpense(req, res) {
    return ok(res, await service.deleteExpense(req.params.id, req.user, req));
  },

  // Derived views
  async accounts(req, res) {
    return ok(res, await service.accounts());
  },
  async projectSummary(req, res) {
    return ok(res, await service.projectSummary(req.params.projectId));
  },
  async overview(req, res) {
    return ok(res, await service.overview(req.query));
  },
};

module.exports = financeController;
