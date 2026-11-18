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
const status = z.enum(['open', 'in_progress', 'resolved', 'closed']);
const s = {
  idParam: z.object({ id }),
  list: z.object({ status: z.union([status, z.literal('active')]).optional(), projectId: id.optional(), priority: priority.optional(), scope: z.enum(['all', 'mine', 'assigned']).optional(), search: z.string().trim().optional() }),
  create: z.object({ projectId: id.optional().nullable(), title: z.string().min(1).max(200), description: z.string().max(5000).optional(), priority: priority.optional(), visibility: z.enum(['assigned', 'all']).optional(), assigneeIds: z.array(id).max(50).optional() }),
  update: z.object({ status: status.optional(), priority: priority.optional(), visibility: z.enum(['assigned', 'all']).optional(), assigneeIds: z.array(id).max(50).optional(), title: z.string().min(1).max(200).optional(), description: z.string().max(5000).nullable().optional() }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
  reply: z.object({ message: z.string().min(1).max(5000) }),
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
  router.post('/:id/replies', read, validate({ params: s.idParam, body: s.reply }), h(async (req, res) => created(res, await service.reply(req.params.id, req.body, req.user, req))));
}

module.exports = { registerRoutes };
