'use strict';

const { z } = require('zod');
const service = require('./workforce.service');
const { ok } = require('../../core/http/response');
const contractSchema = z.object({ title: z.string().trim().min(1).max(200), projectId: z.coerce.number().int().positive().nullable().optional(), amount: z.coerce.number().nonnegative(), retentionPercent: z.coerce.number().min(0).max(50).optional(), startDate: z.coerce.date().nullable().optional(), endDate: z.coerce.date().nullable().optional(), status: z.enum(['active', 'completed', 'cancelled']).optional(), notes: z.string().max(2000).nullable().optional() });

const controller = require('./workforce.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { createWorkforceSchema, updateWorkforceSchema, listQuery, idParam } = require('./workforce.validation');

function registerRoutes(router) {
  router.use(authenticate);
  router.get('/', authorize('workforce.read'), validate({ query: listQuery }), asyncHandler(controller.list));
  router.get('/stats', authorize('workforce.read'), asyncHandler(controller.stats));
  router.get('/project-costs', authorize('workforce.read'), validate({ query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() }) }), asyncHandler(async (req, res) => ok(res, await service.projectCosts(req.user, req.query))));
  router.post('/:id/contracts', authorize('workforce.update'), validate({ params: idParam, body: contractSchema }), asyncHandler(async (req, res) => ok(res, await service.saveContract(req.params.id, req.body, req.user, req))));
  router.patch('/contracts/:contractId', authorize('workforce.update'), validate({ params: z.object({ contractId: z.coerce.number().int().positive() }), body: contractSchema.partial() }), asyncHandler(async (req, res) => {
    const prisma = require('../../config/prisma');
    const c = await prisma.workContract.findFirst({ where: { id: req.params.contractId, deletedAt: null } });
    if (!c) return res.status(404).json({ success: false, error: { message: 'Contract not found' } });
    return ok(res, await service.saveContract(c.workforceId, { ...c, amount: Number(c.amount), retentionPercent: Number(c.retentionPercent), ...req.body }, req.user, req, c.id));
  }));
  router.delete('/contracts/:contractId', authorize('workforce.update'), validate({ params: z.object({ contractId: z.coerce.number().int().positive() }) }), asyncHandler(async (req, res) => ok(res, await service.removeContract(req.params.contractId, req.user, req))));
  router.get('/:id/overview', authorize('workforce.read'), validate({ params: idParam }), asyncHandler(controller.overview));
  router.get('/:id', authorize('workforce.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.post('/', authorize('workforce.create'), validate({ body: createWorkforceSchema }), asyncHandler(controller.create));
  router.patch('/:id', authorize('workforce.update'), validate({ params: idParam, body: updateWorkforceSchema }), asyncHandler(controller.update));
  router.delete('/:id', authorize('workforce.delete'), validate({ params: idParam }), asyncHandler(controller.remove));
}

module.exports = { registerRoutes };
