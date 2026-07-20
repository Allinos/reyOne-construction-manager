import api, { unwrap } from '../../lib/api';

// Returns { items, meta } for paginated lists.
export const listProjects = (params) =>
  api.get('/projects', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));

export const getProject = (id) => unwrap(api.get(`/projects/${id}`));
export const listClients = () => unwrap(api.get('/projects/clients'));
export const lastReference = () => unwrap(api.get('/projects/last-reference'));
export const projectAnalytics = () => unwrap(api.get('/projects/analytics'));
export const createProject = (body) => unwrap(api.post('/projects', body));
export const updateProject = (id, body) => unwrap(api.patch(`/projects/${id}`, body));
export const deleteProject = (id) => unwrap(api.delete(`/projects/${id}`));

export const addPhase = (id, body) => unwrap(api.post(`/projects/${id}/phases`, body));
export const updatePhase = (id, phaseId, body) => unwrap(api.patch(`/projects/${id}/phases/${phaseId}`, body));
export const deletePhase = (id, phaseId) => unwrap(api.delete(`/projects/${id}/phases/${phaseId}`));

export const assignProjectEmployees = (id, userIds) => unwrap(api.post(`/projects/${id}/assignees`, { userIds }));
export const listEmployees = () =>
  api.get('/users', { params: { limit: 100, status: 'ACTIVE' } }).then((r) => r.data.data).catch(() => []);

export const addTask = (id, phaseId, body) => unwrap(api.post(`/projects/${id}/phases/${phaseId}/tasks`, body));
export const updateTask = (id, phaseId, taskId, body) =>
  unwrap(api.patch(`/projects/${id}/phases/${phaseId}/tasks/${taskId}`, body));
export const deleteTask = (id, phaseId, taskId) =>
  unwrap(api.delete(`/projects/${id}/phases/${phaseId}/tasks/${taskId}`));

// Field-definition config (the ⚙️ on the project form).
export const getFieldDefs = () =>
  unwrap(api.get('/settings/field-definitions', { params: { entityType: 'project' } }));
export const createFieldDef = (body) => unwrap(api.post('/settings/field-definitions', body));
export const updateFieldDef = (defId, body) => unwrap(api.patch(`/settings/field-definitions/${defId}`, body));
export const deleteFieldDef = (defId) => unwrap(api.delete(`/settings/field-definitions/${defId}`));
