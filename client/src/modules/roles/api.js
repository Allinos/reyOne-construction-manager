import api, { unwrap } from '../../lib/api';

export const listRoles = () => unwrap(api.get('/roles'));
export const createRole = (body) => unwrap(api.post('/roles', body));
export const updateRole = (id, body) => unwrap(api.patch(`/roles/${id}`, body));
export const deleteRole = (id) => unwrap(api.delete(`/roles/${id}`));

// Permission catalog grouped by module: { module: [{ key, action, description }] }
export const listPermissions = () => unwrap(api.get('/roles/permissions'));
