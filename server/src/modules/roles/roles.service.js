'use strict';

const repo = require('./roles.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toRole(role) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionKeys: (role.permissions || []).map((rp) => rp.permission.key),
  };
}

// Resolves requested permission keys to ids, rejecting unknown keys.
async function resolvePermissionIds(keys) {
  const unique = [...new Set(keys)];
  const perms = await repo.findPermissionsByKeys(unique);
  if (perms.length !== unique.length) {
    const found = new Set(perms.map((p) => p.key));
    const missing = unique.filter((k) => !found.has(k));
    throw AppError.badRequest(`Unknown permission(s): ${missing.join(', ')}`);
  }
  return perms.map((p) => p.id);
}

const rolesService = {
  async list() {
    const roles = await repo.findMany();
    return roles.map(toRole);
  },

  async get(id) {
    const role = await repo.findById(id);
    if (!role) throw AppError.notFound('Role not found');
    return toRole(role);
  },

  async listPermissions() {
    const perms = await repo.listPermissions();
    // Group by module for easy rendering of a permission matrix.
    const grouped = {};
    for (const p of perms) {
      (grouped[p.module] ||= []).push({ key: p.key, action: p.action, description: p.description });
    }
    return grouped;
  },

  async create(payload, actor, req) {
    const key = payload.key || slugify(payload.name);
    if (await repo.findByKey(key)) throw AppError.conflict('A role with this key already exists');

    const permissionIds = await resolvePermissionIds(payload.permissionKeys || []);
    const role = await repo.create({ key, name: payload.name, description: payload.description, isSystem: false });
    await repo.setPermissions(role.id, permissionIds);

    activity.record({ userId: actor.id, action: 'role.created', entityType: 'role', entityId: role.id, req });
    return this.get(role.id);
  },

  async update(id, payload, actor, req) {
    const role = await repo.findById(id);
    if (!role) throw AppError.notFound('Role not found');

    const fields = {};
    if (payload.name !== undefined) fields.name = payload.name;
    if (payload.description !== undefined) fields.description = payload.description;
    if (Object.keys(fields).length) await repo.updateFields(id, fields);

    if (payload.permissionKeys !== undefined) {
      // Guard the Owner role's all-access so it can't be silently downgraded.
      if (role.key === 'owner' && !payload.permissionKeys.includes('*')) {
        throw AppError.badRequest('The Owner role must retain full access');
      }
      const permissionIds = await resolvePermissionIds(payload.permissionKeys);
      await repo.setPermissions(id, permissionIds);
    }

    activity.record({ userId: actor.id, action: 'role.updated', entityType: 'role', entityId: id, req });
    return this.get(id);
  },

  async remove(id, actor, req) {
    const role = await repo.findById(id);
    if (!role) throw AppError.notFound('Role not found');
    if (role.isSystem) throw AppError.badRequest('System roles cannot be deleted');

    const userCount = await repo.countUsers(id);
    if (userCount > 0) {
      throw AppError.conflict(`Cannot delete: ${userCount} user(s) still have this role`);
    }

    await repo.delete(id);
    activity.record({ userId: actor.id, action: 'role.deleted', entityType: 'role', entityId: id, req });
    return { success: true };
  },
};

module.exports = rolesService;
