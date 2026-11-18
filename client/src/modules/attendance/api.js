import api, { unwrap } from '../../lib/api';

export const getDay = (params) => unwrap(api.get('/attendance/day', { params }));
export const saveDay = (body) => unwrap(api.put('/attendance/day', body));
export const getSummary = (params) => unwrap(api.get('/attendance/summary', { params }));
export const getPersonMonth = (params) => unwrap(api.get('/attendance/person', { params }));
export const listProjectsLite = () =>
  api.get('/projects', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []);
