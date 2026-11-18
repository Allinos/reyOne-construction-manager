import api, { unwrap } from '../../lib/api';

export const listQueries = (params) => unwrap(api.get('/queries', { params }));
export const getQuery = (id) => unwrap(api.get(`/queries/${id}`));
export const createQuery = (b) => unwrap(api.post('/queries', b));
export const updateQuery = (id, b) => unwrap(api.patch(`/queries/${id}`, b));
export const deleteQuery = (id) => unwrap(api.delete(`/queries/${id}`));
export const replyQuery = (id, message) => unwrap(api.post(`/queries/${id}/replies`, { message }));
export const queryCounts = () => unwrap(api.get('/queries/counts'));
export const listProjectsLite = () => api.get('/projects', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []);
