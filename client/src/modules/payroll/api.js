import api, { unwrap } from '../../lib/api';

export const getProfiles = (params) => unwrap(api.get('/payroll/profiles', { params }));
export const saveProfile = (body) => unwrap(api.put('/payroll/profiles', body));
export const getPayrollSummary = (params) => unwrap(api.get('/payroll/summary', { params }));
export const getLedger = (params) => unwrap(api.get('/payroll/ledger', { params }));
export const listPayments = (params) =>
  api.get('/payroll/payments', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const createPayment = (body) => unwrap(api.post('/payroll/payments', body));
export const deletePayment = (id) => unwrap(api.delete(`/payroll/payments/${id}`));
export const listAdvances = (params) => unwrap(api.get('/payroll/advances', { params }));
export const createAdvance = (body) => unwrap(api.post('/payroll/advances', body));
export const deleteAdvance = (id) => unwrap(api.delete(`/payroll/advances/${id}`));
