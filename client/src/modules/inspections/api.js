import api, { unwrap } from '../../lib/api';

export const getTemplates = () => unwrap(api.get('/inspections/templates'));
export const listInspections = (params) => unwrap(api.get('/inspections', { params }));
export const getInspection = (id) => unwrap(api.get(`/inspections/${id}`));
export const createInspection = (b) => unwrap(api.post('/inspections', b));
export const updateInspection = (id, b) => unwrap(api.patch(`/inspections/${id}`, b));
export const deleteInspection = (id) => unwrap(api.delete(`/inspections/${id}`));
export const addIssue = (id, b) => unwrap(api.post(`/inspections/${id}/issues`, b));
export const updateIssue = (issueId, b) => unwrap(api.patch(`/inspections/issues/${issueId}`, b));
export const listIssues = (params) => unwrap(api.get('/inspections/issues', { params }));
export const getReport = (id) => unwrap(api.get(`/inspections/${id}/report`));
export const listProjectsLite = () => api.get('/projects', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []);
export const getStats = () => unwrap(api.get('/inspections/stats'));
