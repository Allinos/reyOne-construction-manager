import api, { unwrap } from '../../lib/api';

export const listUsers = (params) =>
  api.get('/users', { params }).then((r) => ({ items: r.data.data, meta: r.data.meta }));
export const createUser = (body) => unwrap(api.post('/users', body));
export const updateUser = (id, body) => unwrap(api.patch(`/users/${id}`, body));
export const deleteUser = (id) => unwrap(api.delete(`/users/${id}`));
export const resetPassword = (id, newPassword) => unwrap(api.post(`/users/${id}/reset-password`, { newPassword }));

// Roles for the assignment dropdown (requires roles.read).
export const rolesForSelect = () => unwrap(api.get('/roles')).catch(() => []);
