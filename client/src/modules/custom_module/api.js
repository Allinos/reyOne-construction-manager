import api, { unwrap } from '../../lib/api';

export const listRecords = (params) =>
  api.get('/custom-module/records', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const createRecord = (values) => unwrap(api.post('/custom-module/records', { values }));
export const updateRecord = (id, values) => unwrap(api.patch(`/custom-module/records/${id}`, { values }));
export const deleteRecord = (id) => unwrap(api.delete(`/custom-module/records/${id}`));

export const getConfig = () => unwrap(api.get('/custom-module/config'));
export const setConfig = (body) => unwrap(api.put('/custom-module/config', body));
export const getAnalytics = () => unwrap(api.get('/custom-module/analytics'));
