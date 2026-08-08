'use strict';

const repo = require('./custom_module.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const customModuleService = {
  async listRecords(query) {
    const { page, limit, skip, take } = getPagination(query, { defaultLimit: 50 });
    const { rows, total } = await repo.listRecords({ skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async createRecord(payload, actor, req) {
    const record = await repo.createRecord(payload.values || {});
    activity.record({ userId: actor.id, action: 'custom_module.created', entityType: 'custom_record', entityId: record.id, req });
    return record;
  },

  async updateRecord(id, payload, actor, req) {
    const existing = await repo.findRecord(id);
    if (!existing) throw AppError.notFound('Record not found');
    const record = await repo.updateRecord(id, payload.values || {});
    activity.record({ userId: actor.id, action: 'custom_module.updated', entityType: 'custom_record', entityId: id, req });
    return record;
  },

  async removeRecord(id, actor, req) {
    const existing = await repo.findRecord(id);
    if (!existing) throw AppError.notFound('Record not found');
    await repo.softDeleteRecord(id);
    activity.record({ userId: actor.id, action: 'custom_module.deleted', entityType: 'custom_record', entityId: id, req });
    return { success: true };
  },

  // --- Config ---
  async getConfig() {
    const [name, fields, listFields] = await Promise.all([
      repo.getSetting('name'),
      repo.getSetting('fields'),
      repo.getSetting('list_fields'),
    ]);
    return { name: name || 'Custom Module', fields: fields || [], listFields: listFields || [] };
  },

  async setConfig(payload, actor, req) {
    await repo.setSetting('fields', payload.fields);
    if (payload.listFields !== undefined) await repo.setSetting('list_fields', payload.listFields);
    if (payload.name !== undefined) await repo.setSetting('name', payload.name);
    activity.record({ userId: actor.id, action: 'custom_module.configured', entityType: 'custom_module', entityId: 0, req });
    return this.getConfig();
  },

  // --- Analytics: aggregate numeric fields across all records ---
  async analytics() {
    const fields = (await repo.getSetting('fields')) || [];
    const numberFields = fields.filter((f) => f.type === 'number');
    const records = await repo.allRecords();

    const metrics = numberFields.map((f) => {
      const nums = records
        .map((r) => Number(r.values?.[f.id]))
        .filter((n) => Number.isFinite(n));
      const sum = nums.reduce((a, b) => a + b, 0);
      const count = nums.length;
      return {
        id: f.id,
        label: f.label,
        count,
        sum,
        avg: count ? sum / count : 0,
        min: count ? Math.min(...nums) : 0,
        max: count ? Math.max(...nums) : 0,
      };
    });

    return { totalRecords: records.length, metrics };
  },
};

module.exports = customModuleService;
