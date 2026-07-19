'use strict';

const repo = require('./modules.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { loadManifests } = require('../../core/modules/registry');

// Builds { key: [dependsOn...] } from the module manifests on disk.
function dependencyMap() {
  const map = {};
  for (const m of loadManifests()) map[m.key] = m.dependsOn || [];
  return map;
}

const modulesService = {
  async list() {
    const deps = dependencyMap();
    const rows = await repo.findAll();
    return rows.map((m) => ({
      key: m.key,
      name: m.name,
      description: m.description,
      enabled: m.enabled,
      isCore: m.isCore,
      sortOrder: m.sortOrder,
      dependsOn: deps[m.key] || [],
      hasCode: Object.prototype.hasOwnProperty.call(deps, m.key), // false = seeded-but-not-yet-built
    }));
  },

  async toggle(key, enabled, actor, req) {
    const module = await repo.findByKey(key);
    if (!module) throw AppError.notFound('Module not found');
    if (module.isCore) throw AppError.badRequest('Core modules cannot be disabled');
    if (module.enabled === enabled) return this._shape(module, enabled);

    const deps = dependencyMap();

    if (enabled) {
      // Every dependency must be enabled first.
      const missing = [];
      for (const dep of deps[key] || []) {
        const depModule = await repo.findByKey(dep);
        if (depModule && !depModule.isCore && !depModule.enabled) missing.push(dep);
      }
      if (missing.length) {
        throw AppError.badRequest(`Enable required module(s) first: ${missing.join(', ')}`);
      }
    } else {
      // No enabled module may still depend on this one.
      const dependents = Object.entries(deps)
        .filter(([, list]) => list.includes(key))
        .map(([k]) => k);
      const enabledDependents = await repo.findEnabledDependents(dependents);
      if (enabledDependents.length) {
        const names = enabledDependents.map((d) => d.key).join(', ');
        throw AppError.badRequest(`Disable dependent module(s) first: ${names}`);
      }
    }

    const updated = await repo.setEnabled(key, enabled);
    activity.record({
      userId: actor.id,
      action: enabled ? 'module.enabled' : 'module.disabled',
      entityType: 'module',
      entityId: key,
      req,
    });
    return this._shape(updated, enabled);
  },

  _shape(module, enabled) {
    return {
      key: module.key,
      name: module.name,
      enabled,
      isCore: module.isCore,
      // Route mounting happens at boot, so a toggle takes effect on next restart.
      requiresRestart: true,
    };
  },
};

module.exports = modulesService;
