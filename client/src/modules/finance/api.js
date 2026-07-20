import api, { unwrap } from '../../lib/api';

export const listPayments = (params) =>
  api.get('/finance/payments', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const createPayment = (body) => unwrap(api.post('/finance/payments', body));
export const updatePayment = (id, body) => unwrap(api.patch(`/finance/payments/${id}`, body));
export const deletePayment = (id) => unwrap(api.delete(`/finance/payments/${id}`));

export const listExpenses = (params) =>
  api.get('/finance/expenses', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const createExpense = (body) => unwrap(api.post('/finance/expenses', body));
export const updateExpense = (id, body) => unwrap(api.patch(`/finance/expenses/${id}`, body));
export const deleteExpense = (id) => unwrap(api.delete(`/finance/expenses/${id}`));

export const getAccounts = () => unwrap(api.get('/finance/accounts'));
export const getOverview = (params) => unwrap(api.get('/finance/overview', { params }));
export const getAnalytics = () => unwrap(api.get('/finance/analytics'));
export const getProjectSummary = (projectId) => unwrap(api.get(`/finance/projects/${projectId}/summary`));

// Lightweight project options for the payment/expense selectors.
export const projectOptions = () =>
  api.get('/projects', { params: { limit: 100 } }).then((r) => r.data.data);
