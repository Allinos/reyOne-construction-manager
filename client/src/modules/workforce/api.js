import api, { unwrap } from '../../lib/api';

export const listWorkforce = (params) =>
  api.get('/workforce', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const createWorkforce = (body) => unwrap(api.post('/workforce', body));
export const updateWorkforce = (id, body) => unwrap(api.patch(`/workforce/${id}`, body));
export const deleteWorkforce = (id) => unwrap(api.delete(`/workforce/${id}`));

// For payee selectors in the expense form.
export const workforceOptions = () =>
  api.get('/workforce', { params: { limit: 300, status: 'ACTIVE' } }).then((r) => r.data.data).catch(() => []);
export const getOverview = (id) => unwrap(api.get(`/workforce/${id}/overview`));
export const getWorkforceStats = () => unwrap(api.get('/workforce/stats'));
