'use strict';

const repo = require('./requirements.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');

const requirementsService = {
  async listRequirements(query) {
    const where = { projectId: query.projectId };
    if (query.kind) where.kind = query.kind;
    return repo.listRequirements(where);
  },

  async createRequirement(payload, actor, req) {
    const item = await repo.createRequirement({
      projectId: payload.projectId,
      kind: payload.kind,
      title: payload.title ?? null,
      content: payload.content ?? {},
      sortOrder: payload.sortOrder ?? 0,
    });
    activity.record({ userId: actor.id, action: 'requirements.created', entityType: 'requirement', entityId: item.id, req });
    return item;
  },

  async updateRequirement(id, payload, actor, req) {
    const existing = await repo.findRequirement(id);
    if (!existing) throw AppError.notFound('Requirement not found');
    const data = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
    const item = await repo.updateRequirement(id, data);
    activity.record({ userId: actor.id, action: 'requirements.updated', entityType: 'requirement', entityId: id, req });
    return item;
  },

  async removeRequirement(id, actor, req) {
    const existing = await repo.findRequirement(id);
    if (!existing) throw AppError.notFound('Requirement not found');
    await repo.deleteRequirement(id);
    activity.record({ userId: actor.id, action: 'requirements.deleted', entityType: 'requirement', entityId: id, req });
    return { success: true };
  },

  // --- Photos ---
  async listPhotos(query) {
    return repo.listPhotos(query.projectId);
  },

  async createPhoto(payload, actor, req) {
    const photo = await repo.createPhoto({
      projectId: payload.projectId,
      name: payload.name ?? null,
      mimeType: payload.mimeType ?? null,
      category: payload.category ?? null,
      data: payload.data,
    });
    activity.record({ userId: actor.id, action: 'requirements.photo_added', entityType: 'project_photo', entityId: photo.id, req });
    return photo;
  },

  async updatePhoto(id, payload, actor, req) {
    const existing = await repo.findPhoto(id);
    if (!existing) throw AppError.notFound('Photo not found');
    const photo = await repo.updatePhoto(id, { category: payload.category ?? null });
    activity.record({ userId: actor.id, action: 'requirements.photo_updated', entityType: 'project_photo', entityId: id, req });
    return photo;
  },

  async removePhoto(id, actor, req) {
    const existing = await repo.findPhoto(id);
    if (!existing) throw AppError.notFound('Photo not found');
    await repo.deletePhoto(id);
    activity.record({ userId: actor.id, action: 'requirements.photo_deleted', entityType: 'project_photo', entityId: id, req });
    return { success: true };
  },
};

module.exports = requirementsService;
