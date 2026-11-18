import api, { unwrap } from '../../lib/api';

// Template library
export const getCatalog = () => unwrap(api.get('/documents/templates'));
export const getTemplate = (key) => unwrap(api.get(`/documents/templates/${key}`));
export const previewDocument = (templateKey, data) =>
  unwrap(api.post('/documents/preview', { templateKey, data }));

// Saved documents
export const listDocuments = (params) =>
  api.get('/documents', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const getDocument = (id) => unwrap(api.get(`/documents/${id}`));
export const createDocument = (body) => unwrap(api.post('/documents', body));
export const updateDocument = (id, body) => unwrap(api.patch(`/documents/${id}`, body));
export const deleteDocument = (id) => unwrap(api.delete(`/documents/${id}`));
export const renderDocument = (id) => unwrap(api.get(`/documents/${id}/render`));

// Lightweight project list for auto-fill (name + client details come via detail).
export const listProjectsForDocs = () =>
  api.get('/projects', { params: { limit: 100 } }).then((r) => r.data.data).catch(() => []);
export const getProjectForDocs = (id) => unwrap(api.get(`/projects/${id}`)).catch(() => null);
