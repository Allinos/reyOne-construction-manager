import api, { unwrap } from '../../lib/api';

export const matAnalytics = () => unwrap(api.get('/materials/analytics'));
export const listItems = (params) => unwrap(api.get('/materials/items', { params }));
export const createItem = (b) => unwrap(api.post('/materials/items', b));
export const updateItem = (id, b) => unwrap(api.patch(`/materials/items/${id}`, b));
export const deleteItem = (id) => unwrap(api.delete(`/materials/items/${id}`));
export const getStock = (params) => unwrap(api.get('/materials/stock', { params }));
export const listMovements = (params) =>
  api.get('/materials/movements', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const getConsumption = (params) => unwrap(api.get('/materials/consumption', { params }));
export const purchase = (b) => unwrap(api.post('/materials/purchase', b));
export const transfer = (b) => unwrap(api.post('/materials/transfer', b));
export const consume = (b) => unwrap(api.post('/materials/consume', b));
export const adjust = (b) => unwrap(api.post('/materials/adjust', b));
export const listRequests = (params) => unwrap(api.get('/materials/requests', { params }));
export const createRequest = (b) => unwrap(api.post('/materials/requests', b));
export const decideRequest = (id, b) => unwrap(api.patch(`/materials/requests/${id}/decide`, b));
export const fulfillRequest = (id, b) => unwrap(api.post(`/materials/requests/${id}/fulfill`, b));
export const listProjectsLite = () => api.get('/projects', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []);
export const listVendorsLite = () => api.get('/vendors', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []);
export const getLocations = (id) => unwrap(api.get(`/materials/items/${id}/locations`));
