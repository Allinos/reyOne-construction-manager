'use strict';

const repo = require('./documents.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');
const { CATEGORIES, listTemplates, getTemplate, renderDocument } = require('../../core/constants/documentTemplates');

// Template metadata exposed to the client for the create form (fields only —
// bodies stay server-side and are merged at render time).
function templateDetail(tpl) {
  return {
    key: tpl.key,
    name: tpl.name,
    category: tpl.category,
    description: tpl.description,
    fields: tpl.fields,
    signatures: tpl.signatures || ['Authorized Signatory'],
  };
}

async function brandingContext() {
  const [company, branding] = await Promise.all([repo.company(), repo.branding()]);
  return { company: company || {}, branding: branding || {} };
}

const documentsService = {
  catalog() {
    return { categories: CATEGORIES, templates: listTemplates() };
  },

  template(key) {
    const tpl = getTemplate(key);
    if (!tpl) throw AppError.notFound('Template not found');
    return templateDetail(tpl);
  },

  async list(query) {
    const { page, limit, skip, take } = getPagination(query);
    const where = { deletedAt: null };
    if (query.templateKey) where.templateKey = query.templateKey;
    if (query.category) where.category = query.category;
    if (query.projectId) where.projectId = Number(query.projectId);
    if (query.search) {
      where.OR = [
        { title: { contains: query.search } },
        { reference: { contains: query.search } },
      ];
    }
    const { rows, total } = await repo.list({ where, skip, take });
    return { data: rows, meta: buildMeta(page, limit, total) };
  },

  async get(id) {
    const doc = await repo.findById(id);
    if (!doc) throw AppError.notFound('Document not found');
    return doc;
  },

  async create(payload, actor, req) {
    const tpl = getTemplate(payload.templateKey);
    if (!tpl) throw AppError.badRequest('Unknown template');
    const doc = await repo.create({
      templateKey: tpl.key,
      title: payload.title || tpl.name,
      category: tpl.category,
      projectId: payload.projectId ?? null,
      clientId: payload.clientId ?? null,
      reference: payload.reference ?? (payload.data && payload.data.reference) ?? null,
      data: payload.data ?? {},
      status: payload.status || 'final',
      createdById: actor.id,
    });
    activity.record({ userId: actor.id, action: 'document.created', entityType: 'document', entityId: doc.id, req });
    return doc;
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Document not found');
    const data = {};
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.data !== undefined) data.data = payload.data;
    if (payload.reference !== undefined) data.reference = payload.reference;
    if (payload.status !== undefined) data.status = payload.status;
    if (payload.projectId !== undefined) data.projectId = payload.projectId;
    if (payload.clientId !== undefined) data.clientId = payload.clientId;
    const doc = await repo.update(id, data);
    activity.record({ userId: actor.id, action: 'document.updated', entityType: 'document', entityId: id, req });
    return doc;
  },

  async remove(id, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Document not found');
    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'document.deleted', entityType: 'document', entityId: id, req });
    return { success: true };
  },

  // Render a saved document to print-ready HTML.
  async render(id) {
    const doc = await repo.findById(id);
    if (!doc) throw AppError.notFound('Document not found');
    const tpl = getTemplate(doc.templateKey);
    if (!tpl) throw AppError.badRequest('Template no longer available');
    const { company, branding } = await brandingContext();
    return { html: renderDocument(tpl, doc.data || {}, company, branding) };
  },

  // Render arbitrary (unsaved) data — used for live preview in the create flow
  // and the template gallery.
  async preview(templateKey, data) {
    const tpl = getTemplate(templateKey);
    if (!tpl) throw AppError.notFound('Template not found');
    const { company, branding } = await brandingContext();
    return { html: renderDocument(tpl, data || {}, company, branding) };
  },
};

module.exports = documentsService;
