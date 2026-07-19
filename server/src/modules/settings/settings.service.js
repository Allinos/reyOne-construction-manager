'use strict';

const repo = require('./settings.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');

const settingsService = {
  // --- Company ---
  async getCompany() {
    return (await repo.getCompany()) || null;
  },
  async updateCompany(payload, actor, req) {
    const company = await repo.upsertCompany(payload);
    activity.record({ userId: actor.id, action: 'company.updated', entityType: 'company', entityId: company.id, req });
    return company;
  },

  // --- Generic settings ---
  async list() {
    const rows = await repo.listSettings();
    // Shape as { group: { key: value } } for convenient client consumption.
    const grouped = {};
    for (const r of rows) {
      (grouped[r.group] ||= {})[r.key] = r.value;
    }
    return grouped;
  },
  async getGroup(group) {
    const rows = await repo.listByGroup(group);
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  },
  async upsert(group, key, value, actor, req) {
    const setting = await repo.upsertSetting(group, key, value);
    activity.record({
      userId: actor.id,
      action: 'setting.updated',
      entityType: 'setting',
      entityId: `${group}.${key}`,
      req,
    });
    return setting;
  },

  // --- Field definitions ---
  async listFieldDefs(entityType) {
    return repo.listFieldDefs(entityType);
  },
  async createFieldDef(payload, actor, req) {
    try {
      const def = await repo.createFieldDef(payload);
      activity.record({ userId: actor.id, action: 'field_definition.created', entityType: 'field_definition', entityId: def.id, req });
      return def;
    } catch (err) {
      if (err.code === 'P2002') throw AppError.conflict('A field with this key already exists for this entity');
      throw err;
    }
  },
  async updateFieldDef(id, payload, actor, req) {
    const existing = await repo.findFieldDef(id);
    if (!existing) throw AppError.notFound('Field definition not found');
    const def = await repo.updateFieldDef(id, payload);
    activity.record({ userId: actor.id, action: 'field_definition.updated', entityType: 'field_definition', entityId: id, req });
    return def;
  },
  async deleteFieldDef(id, actor, req) {
    const existing = await repo.findFieldDef(id);
    if (!existing) throw AppError.notFound('Field definition not found');
    if (!existing.isCustom) throw AppError.badRequest('Built-in fields cannot be deleted (toggle visibility instead)');
    await repo.deleteFieldDef(id);
    activity.record({ userId: actor.id, action: 'field_definition.deleted', entityType: 'field_definition', entityId: id, req });
    return { success: true };
  },
};

module.exports = settingsService;
