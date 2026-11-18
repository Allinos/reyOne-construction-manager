'use strict';

const { z } = require('zod');
const service = require('./queries.service');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');

const id = z.coerce.number().int().positive();
const priority = z.enum(['low', 'normal', 'high', 'urgent']);
const status = z.enum(['open', 'assigned', 'awaiting_response', 'responded', 'resolved', 'closed']);
const qtype = z.enum(['rfi', 'clarification', 'site_issue', 'design_change', 'approval', 'general']);
const people = z.array(id).max(50);
const s = {
  idParam: z.object({ id }),
  list: z.object({ status: z.union([status, z.literal('active')]).optional(), projectId: id.optional(), phaseId: id.optional(), priority: priority.optional(), type: qtype.optional(), scope: z.enum(['all', 'mine', 'assigned', 'raised']).optional(), overdue: z.enum(['true', 'false']).optional(), search: z.string().trim().optional() }),
  create: z.object({ projectId: id.optional().nullable(), phaseId: id.optional().nullable(), type: qtype.optional(), category: z.string().max(80).optional().nullable(), location: z.string().max(150).optional().nullable(), workItem: z.string().max(150).optional().nullable(), title: z.string().min(1).max(200), description: z.string().max(5000).optional(), priority: priority.optional(), visibility: z.enum(['assigned', 'all']).optional(), assigneeIds: people.optional(), mentionIds: people.optional(), dueDate: z.coerce.date().optional().nullable(), costImpact: z.boolean().optional(), scheduleImpact: z.boolean().optional() }),
  update: z.object({ priority: priority.optional(), type: qtype.optional(), category: z.string().max(80).nullable().optional(), phaseId: id.nullable().optional(), location: z.string().max(150).nullable().optional(), workItem: z.string().max(150).nullable().optional(), visibility: z.enum(['assigned', 'all']).optional(), assigneeIds: people.optional(), mentionIds: people.optional(), title: z.string().min(1).max(200).optional(), description: z.string().max(5000).nullable().optional(), dueDate: z.coerce.date().nullable().optional(), costImpact: z.boolean().optional(), scheduleImpact: z.boolean().optional() }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
  reply: z.object({ message: z.string().min(1).max(5000), mentionIds: people.optional() }),
  resolve: z.object({ resolution: z.string().trim().min(3, 'Describe the resolution').max(5000) }),
};
const h = (fn) => asyncHandler(fn);

function registerRoutes(router) {
  router.use(authenticate);
  const read = authorize('queries.read');
  router.get('/counts', read, h(async (req, res) => ok(res, await service.counts(req.user))));
  router.get('/', read, validate({ query: s.list }), h(async (req, res) => ok(res, await service.list(req.query, req.user))));
  router.post('/', authorize('queries.create'), validate({ body: s.create }), h(async (req, res) => created(res, await service.create(req.body, req.user, req))));
  router.get('/:id', read, validate({ params: s.idParam }), h(async (req, res) => ok(res, await service.get(req.params.id, req.user))));
  router.patch('/:id', read, validate({ params: s.idParam, body: s.update }), h(async (req, res) => ok(res, await service.update(req.params.id, req.body, req.user, req))));
  router.delete('/:id', read, validate({ params: s.idParam }), h(async (req, res) => ok(res, await service.remove(req.params.id, req.user, req))));
  router.post('/:id/resolve', read, validate({ params: s.idParam, body: s.resolve }), h(async (req, res) => ok(res, await service.resolve(req.params.id, req.body, req.user, req))));
  router.post('/:id/close', read, validate({ params: s.idParam }), h(async (req, res) => ok(res, await service.setState(req.params.id, 'close', req.user, req))));
  router.post('/:id/reopen', read, validate({ params: s.idParam }), h(async (req, res) => ok(res, await service.setState(req.params.id, 'reopen', req.user, req))));
  router.post('/:id/replies', read, validate({ params: s.idParam, body: s.reply }), h(async (req, res) => created(res, await service.reply(req.params.id, req.body, req.user, req))));
}

module.exports = { registerRoutes };
