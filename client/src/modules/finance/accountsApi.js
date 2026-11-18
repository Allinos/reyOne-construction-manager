import api, { unwrap } from '../../lib/api';

export const getSchedule = (projectId) => unwrap(api.get(`/finance/projects/${projectId}/schedule`));
export const addInstallment = (b) => unwrap(api.post('/finance/schedules', b));
export const planInstallments = (b) => unwrap(api.post('/finance/schedules/bulk', b));
export const updateInstallment = (id, b) => unwrap(api.patch(`/finance/schedules/${id}`, b));
export const deleteInstallment = (id) => unwrap(api.delete(`/finance/schedules/${id}`));
export const getCollections = (params) => unwrap(api.get('/finance/collections', { params }));
export const getReceipt = (paymentId) => unwrap(api.get(`/finance/payments/${paymentId}/receipt`));
export const getExpenseReport = (params) => unwrap(api.get('/finance/reports/expenses', { params }));
