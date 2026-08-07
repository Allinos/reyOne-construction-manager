import api, { unwrap } from '../../lib/api';

// --- Requirements (TEXT | FORM | TABLE) ---
export const listRequirements = (projectId, kind) =>
  api
    .get('/requirements', { params: { projectId, ...(kind ? { kind } : {}) } })
    .then((r) => r.data.data);
export const createRequirement = (body) => unwrap(api.post('/requirements', body));
export const updateRequirement = (id, body) => unwrap(api.patch(`/requirements/${id}`, body));
export const deleteRequirement = (id) => unwrap(api.delete(`/requirements/${id}`));

// --- Photos ---
export const listPhotos = (projectId) =>
  api.get('/requirements/photos', { params: { projectId } }).then((r) => r.data.data);
export const createPhoto = (body) => unwrap(api.post('/requirements/photos', body));
export const updatePhoto = (id, body) => unwrap(api.patch(`/requirements/photos/${id}`, body));
export const deletePhoto = (id) => unwrap(api.delete(`/requirements/photos/${id}`));
