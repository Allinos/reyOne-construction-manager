import api, { unwrap } from '../../lib/api';

export const listClients = (params) =>
  api.get('/clients', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const getClient = (id) => unwrap(api.get(`/clients/${id}`));
export const updateClient = (id, body) => unwrap(api.patch(`/clients/${id}`, body));
