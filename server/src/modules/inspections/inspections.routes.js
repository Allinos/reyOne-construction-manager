'use strict';

const { z } = require('zod');
const service = require('./inspections.service');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');
const AppError = require('../../core/errors/AppError');
const { hasPerm } = require('../../core/services/access');

const id = z.coerce.number().int().positive();
const checkItem = z.object({ item: z.string().min(1).max(300), result: z.enum(['pass', 'fail', 'na', '']).optional(), remark: z.string().max(1000).optional().nullable() });
const severity = z.enum(['low', 'medium', 'high', 'critical']);
const issueStatus = z.enum(['open', 'in_progress', 'resolved', 'verified']);

const s = {
  idParam: z.object({ id }),
  issueParam: z.object({ issueId: id }),
  listQuery: z.object({ status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'closed', 'open']).optional(), projectId: id.optional(), mine: z.enum(['true', 'false']).optional() }),
  issuesQuery: z.object({ mine: z.enum(['true', 'false']).optional(), status: z.string().optional() }),
  create: z.object({ projectId: id, title: z.string().min(1).max(200), date: z.coerce.date().optional(), inspectorId: id.optional(), templateKey: z.string().max(60).optional(), checklist: z.array(checkItem).max(200).optional(), remarks: z.string().max(5000).optional(), instructions: z.string().max(5000).optional(), dueDate: z.coerce.date().optional().nullable() }),
  update: z.object({ title: z.string().min(1).max(200).optional(), date: z.coerce.date().optional(), checklist: z.array(checkItem).max(200).optional(), remarks: z.string().max(5000).nullable().optional(), instructions: z.string().max(5000).nullable().optional(), dueDate: z.coerce.date().nullable().optional(), inspectorId: id.optional(), status: z.enum(['assigned', 'in_progress', 'completed', 'closed']).optional() }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
  issue: z.object({ description: z.string().min(1).max(3000), severity: severity.optional(), assignedToId: id.optional().nullable(), correctiveAction: z.string().max(3000).optional(), dueDate: z.coerce.date().optional().nullable() }),
  issueUpdate: z.object({ description: z.string().min(1).max(3000).optional(), severity: severity.optional(), assignedToId: id.nullable().optional(), correctiveAction: z.string().max(3000).nullable().optional(), dueDate: z.coerce.date().nullable().optional(), status: issueStatus.optional() }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
};

const h = (fn) => asyncHandler(fn);

function registerRoutes(router) {
  router.use(authenticate);
  const read = authorize('inspections.read');
  const manage = authorize('inspections.manage');
  router.get('/templates', read, h(async (req, res) => ok(res, await service.templates())));
  // Assignees can always list and progress issues assigned to them, even
  // without inspections.read; the service enforces the rest.
  router.get('/issues', validate({ query: s.issuesQuery }), h(async (req, res, next) => {
    if (req.query.mine !== 'true' && !hasPerm(req.user, 'inspections.read')) return next(AppError.forbidden('You do not have permission to do this'));
    return ok(res, await service.issues(req.query, req.user));
  }));
  router.patch('/issues/:issueId', validate({ params: s.issueParam, body: s.issueUpdate }), h(async (req, res) => ok(res, await service.updateIssue(req.params.issueId, req.body, req.user, req))));
  router.get('/', validate({ query: s.listQuery }), h(async (req, res) => ok(res, await service.list(req.query, req.user))));
  router.get('/stats', h(async (req, res) => ok(res, await service.stats(req.user))));
  router.post('/', manage, validate({ body: s.create }), h(async (req, res) => created(res, await service.create(req.body, req.user, req))));
  router.get('/:id', validate({ params: s.idParam }), h(async (req, res) => ok(res, await service.get(req.params.id, req.user))));
  router.get('/:id/report', validate({ params: s.idParam }), h(async (req, res) => ok(res, await service.report(req.params.id, req.user))));
  router.patch('/:id', validate({ params: s.idParam, body: s.update }), h(async (req, res) => ok(res, await service.update(req.params.id, req.body, req.user, req))));
  router.delete('/:id', manage, validate({ params: s.idParam }), h(async (req, res) => ok(res, await service.remove(req.params.id, req.user, req))));
  router.post('/:id/issues', validate({ params: s.idParam, body: s.issue }), h(async (req, res) => created(res, await service.addIssue(req.params.id, req.body, req.user, req))));
}

module.exports = { registerRoutes };
