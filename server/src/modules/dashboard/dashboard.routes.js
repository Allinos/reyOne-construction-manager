'use strict';

const { insights } = require('./dashboard.insights');
const { ok } = require('../../core/http/response');

const controller = require('./dashboard.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { chartsQuery } = require('./dashboard.validation');
const prisma = require('../../config/prisma');
const { hasPerm, accessibleProjectIds } = require('../../core/services/access');

async function navCounts(actor) {
  const out = {};
  const allowed = await accessibleProjectIds(actor);
  const scope = allowed === null ? {} : { id: { in: allowed } };
  const safe = (p) => p.catch(() => undefined);
  const jobs = [];
  if (hasPerm(actor, 'projects.read')) {
    jobs.push(safe(prisma.project.count({ where: { deletedAt: null, status: { not: 'completed' }, ...scope } })).then((n) => { out.projects = n; }));
  }
  if (hasPerm(actor, 'materials.approve') || hasPerm(actor, 'materials.manage')) {
    jobs.push(safe(prisma.materialRequest.count({ where: { status: 'pending', ...(allowed === null ? {} : { projectId: { in: allowed } }) } })).then((n) => { out.materials = n; }));
  }
  jobs.push(safe(prisma.inspection.count({ where: { deletedAt: null, inspectorId: actor.id, status: { in: ['assigned', 'in_progress', 'open'] } } })).then((n) => { out.inspections = n; }));
  if (hasPerm(actor, 'queries.read')) {
    // eslint-disable-next-line global-require
    jobs.push(safe(require('../queries/queries.service').counts(actor)).then((c) => { if (c) { out.queries = c.assignedToMe + c.awaitingMe; out.queriesUrgent = c.overdue > 0 || c.assignedToMe > 0; } }));
  }
  await Promise.all(jobs);
  return out;
}

function registerRoutes(router) {
  router.use(authenticate);
  // Role-aware sections (each gated by module + permission inside).
  router.get('/insights', authorize('dashboard.read'), asyncHandler(async (req, res) => ok(res, await insights(req.user))));
  // Company-wide financial summary & charts are finance data.
  router.get('/summary', authorize('finance.read'), asyncHandler(controller.summary));
  router.get('/charts', authorize('finance.read'), validate({ query: chartsQuery }), asyncHandler(controller.charts));
  router.get('/activity', authorize('dashboard.read'), asyncHandler(controller.activity));
  // Small counts for the sidebar badges — each one only if the user can see that module.
  router.get('/nav-counts', asyncHandler(async (req, res) => ok(res, await navCounts(req.user))));
}

module.exports = { registerRoutes };
