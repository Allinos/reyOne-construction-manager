import api, { unwrap } from '../../lib/api';

export const listVendors = (params) =>
  api.get('/vendors', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const getVendor = (id) => unwrap(api.get(`/vendors/${id}`));
export const getVendorLedger = (id) => unwrap(api.get(`/vendors/${id}/ledger`));
export const createVendor = (body) => unwrap(api.post('/vendors', body));
export const updateVendor = (id, body) => unwrap(api.patch(`/vendors/${id}`, body));
export const deleteVendor = (id) => unwrap(api.delete(`/vendors/${id}`));

// For selectors in the expense forms.
export const vendorOptions = () => api.get('/vendors', { params: { limit: 200 } }).then((r) => r.data.data).catch(() => []);
