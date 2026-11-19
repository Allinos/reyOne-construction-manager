'use strict';

const { z } = require('zod');
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');
const { hasPerm } = require('../../core/services/access');

/**
 * Generic attachment store. Each entity type maps to the permissions needed to
 * read and to write its files, so access follows the owning module's rules.
 */
const ENTITY_PERMS = {
  inspection: { read: 'inspections.read', write: 'inspections.manage' },
  inspection_issue: { read: 'inspections.read', write: 'inspections.read' },
  query: { read: 'queries.read', write: 'queries.read' },
  vendor_bill: { read: 'vendors.read', write: 'vendors.update' },
  expense: { read: 'finance.read', write: 'finance.update' },
  client: { read: 'clients.read', write: 'clients.update' },
  material_request: { read: 'materials.read', write: 'materials.request' },
  user: { read: 'users.read', write: 'users.update' },
};
const MAX_BYTES = 8 * 1024 * 1024;

async function guard(actor, entityType, mode, entityId) {
  const rule = ENTITY_PERMS[entityType];
  if (!rule) throw AppError.badRequest('Unsupported attachment type');
  if (hasPerm(actor, rule[mode])) return;
  // The inspector assigned to an inspection may read/add its photos.
  if (entityType === 'inspection' && entityId) {
    const row = await prisma.inspection.findUnique({ where: { id: Number(entityId) }, select: { inspectorId: true } });
    if (row && row.inspectorId === actor.id) return;
  }
  throw AppError.forbidden('You do not have permission to do this');
}

const entityType = z.enum(Object.keys(ENTITY_PERMS));
const listQuery = z.object({ entityType, entityId: z.coerce.number().int().positive(), tag: z.string().max(60).optional(), withData: z.enum(['true', 'false']).optional() });
const createSchema = z.object({
  entityType,
  entityId: z.coerce.number().int().positive(),
  name: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  data: z.string().min(10).refine((d) => d.startsWith('data:'), 'Expected a data URL'),
  caption: z.string().max(255).optional(),
  tag: z.string().max(60).optional(),
  takenAt: z.coerce.date().optional().nullable(),
});
const idParam = z.object({ id: z.coerce.number().int().positive() });

const meta = { id: true, entityType: true, entityId: true, name: true, mimeType: true, size: true, caption: true, tag: true, takenAt: true, uploadedById: true, createdAt: true };

function registerRoutes(router) {
  router.use(authenticate);

  router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
    await guard(req.user, req.query.entityType, 'read', req.query.entityId);
    const rows = await prisma.storedFile.findMany({
      where: { entityType: req.query.entityType, entityId: req.query.entityId, ...(req.query.tag ? { tag: req.query.tag } : {}) },
      select: req.query.withData === 'true' ? { ...meta, data: true } : meta,
      orderBy: { id: 'desc' },
    });
    return ok(res, rows);
  }));

  router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
    const row = await prisma.storedFile.findUnique({ where: { id: req.params.id } });
    if (!row) throw AppError.notFound('File not found');
    await guard(req.user, row.entityType, 'read', row.entityId);
    return ok(res, row);
  }));

  router.post('/', validate({ body: createSchema }), asyncHandler(async (req, res) => {
    await guard(req.user, req.body.entityType, 'write', req.body.entityId);
    const size = Math.round((req.body.data.length * 3) / 4);
    if (size > MAX_BYTES) throw AppError.badRequest('File too large (max 8 MB)');
    const row = await prisma.storedFile.create({
      data: { ...req.body, size, uploadedById: req.user.id },
      select: meta,
    });
    return created(res, row);
  }));

  router.delete('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
    const row = await prisma.storedFile.findUnique({ where: { id: req.params.id }, select: meta });
    if (!row) throw AppError.notFound('File not found');
    // Uploader may remove their own file; otherwise need write permission.
    if (row.uploadedById !== req.user.id) await guard(req.user, row.entityType, 'write', row.entityId);
    await prisma.storedFile.delete({ where: { id: row.id } });
    return ok(res, { success: true });
  }));
}

module.exports = { registerRoutes, ENTITY_PERMS };
