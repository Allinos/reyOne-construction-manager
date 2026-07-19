'use strict';

const controller = require('./finance.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsQuery,
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuery,
  idParam,
  projectIdParam,
  overviewQuery,
} = require('./finance.validation');

function registerRoutes(router) {
  router.use(authenticate);

  // Payments
  router.get('/payments', authorize('finance.read'), validate({ query: listPaymentsQuery }), asyncHandler(controller.listPayments));
  router.post('/payments', authorize('finance.create'), validate({ body: createPaymentSchema }), asyncHandler(controller.createPayment));
  router.patch('/payments/:id', authorize('finance.update'), validate({ params: idParam, body: updatePaymentSchema }), asyncHandler(controller.updatePayment));
  router.delete('/payments/:id', authorize('finance.delete'), validate({ params: idParam }), asyncHandler(controller.deletePayment));

  // Expenses
  router.get('/expenses', authorize('finance.read'), validate({ query: listExpensesQuery }), asyncHandler(controller.listExpenses));
  router.post('/expenses', authorize('finance.create'), validate({ body: createExpenseSchema }), asyncHandler(controller.createExpense));
  router.patch('/expenses/:id', authorize('finance.update'), validate({ params: idParam, body: updateExpenseSchema }), asyncHandler(controller.updateExpense));
  router.delete('/expenses/:id', authorize('finance.delete'), validate({ params: idParam }), asyncHandler(controller.deleteExpense));

  // Derived views
  router.get('/accounts', authorize('finance.read'), asyncHandler(controller.accounts));
  router.get('/overview', authorize('finance.read'), validate({ query: overviewQuery }), asyncHandler(controller.overview));
  router.get('/projects/:projectId/summary', authorize('finance.read'), validate({ params: projectIdParam }), asyncHandler(controller.projectSummary));
}

module.exports = { registerRoutes };
