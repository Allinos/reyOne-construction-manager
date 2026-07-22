import api, { unwrap } from '../../lib/api';

export const listDocuments = (type, params) =>
  api.get('/invoices/documents', { params: { type, ...params } }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const getDocument = (id) => unwrap(api.get(`/invoices/documents/${id}`));
export const createDocument = (body) => unwrap(api.post('/invoices/documents', body));
export const updateDocument = (id, body) => unwrap(api.patch(`/invoices/documents/${id}`, body));
export const deleteDocument = (id) => unwrap(api.delete(`/invoices/documents/${id}`));
export const nextNumber = (type) => unwrap(api.get('/invoices/next-number', { params: { type } }));
export const getConfig = () => unwrap(api.get('/invoices/config'));
export const updateConfig = (value) => unwrap(api.put('/invoices/config', { value }));

// Optional project link + client prefill (best-effort; may 403 if Projects disabled).
export const listProjectsLite = () =>
  api.get('/projects', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []);
