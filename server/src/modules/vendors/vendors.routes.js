'use strict';

const prisma = require('../../config/prisma');
const { ok } = require('../../core/http/response');

const controller = require('./vendors.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { createVendorSchema, updateVendorSchema, listQuery, idParam } = require('./vendors.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', authorize('vendors.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.get('/:id', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.get('/:id/ledger', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(controller.ledger));
  // Material purchase history from the inventory ledger.
  router.get('/:id/purchases', authorize('vendors.read'), validate({ params: idParam }), asyncHandler(async (req, res) => {
    const rows = await prisma.stockMovement.findMany({ where: { vendorId: req.params.id, type: 'PURCHASE' }, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 300 });
    const mats = await prisma.material.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.materialId))] } }, select: { id: true, name: true, unit: true } });
    const projects = await prisma.project.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.projectId).filter(Boolean))] } }, select: { id: true, name: true } });
    const mm = new Map(mats.map((m) => [m.id, m]));
    const pm = new Map(projects.map((p) => [p.id, p.name]));
    const items = rows.map((r) => ({
      id: r.id, date: r.date, materialName: mm.get(r.materialId)?.name, unit: mm.get(r.materialId)?.unit,
      quantity: Number(r.quantity), rate: r.rate != null ? Number(r.rate) : null,
      value: r.rate != null ? Math.round(Number(r.quantity) * Number(r.rate) * 100) / 100 : null,
      location: r.projectId ? pm.get(r.projectId) || `#${r.projectId}` : 'Central Store', notes: r.notes,
    }));
    return ok(res, { items, totalValue: Math.round(items.reduce((s, i) => s + (i.value || 0), 0) * 100) / 100 });
  }));
  router.post('/', authorize('vendors.create'), validate({ body: createVendorSchema }), asyncHandler(controller.create));
  router.patch('/:id', authorize('vendors.update'), validate({ params: idParam, body: updateVendorSchema }), asyncHandler(controller.update));
  router.delete('/:id', authorize('vendors.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
