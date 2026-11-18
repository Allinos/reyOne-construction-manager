'use strict';

/** Client depth: account (collections + installment schedule) and notes log. */
const { z } = require('zod');
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const asyncHandler = require('../../core/http/asyncHandler');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');
const { projectCollections, totals } = require('../../core/services/collections');
const { userNames } = require('../../core/services/people');
const { hasPerm } = require('../../core/services/access');

const id = z.coerce.number().int().positive();

async function clientOr404(clientId) {
  const c = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!c) throw AppError.notFound('Client not found');
  return c;
}

function registerClientExtras(router) {
  const h = (fn) => asyncHandler(fn);

  // Collections, outstanding, installments and payment history for a client.
  router.get('/:id/account', authorize('clients.read'), validate({ params: z.object({ id }) }), h(async (req, res) => {
    const client = await clientOr404(req.params.id);
    // Money detail is finance data: only for finance.read holders.
    if (!hasPerm(req.user, 'finance.read')) return ok(res, { restricted: true });
    const projects = await projectCollections({ clientName: client.name });
    const ids = projects.map((p) => p.projectId);
    const payments = ids.length
      ? await prisma.payment.findMany({ where: { projectId: { in: ids } }, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 200 })
      : [];
    const pn = new Map(projects.map((p) => [p.projectId, p.projectName]));
    return ok(res, {
      totals: totals(projects),
      projects,
      payments: payments.map((p) => ({ ...p, amount: Number(p.amount), projectName: pn.get(p.projectId) })),
    });
  }));

  router.get('/:id/notes', authorize('clients.read'), validate({ params: z.object({ id }) }), h(async (req, res) => {
    await clientOr404(req.params.id);
    const rows = await prisma.clientNote.findMany({ where: { clientId: req.params.id }, orderBy: { id: 'desc' }, take: 300 });
    const names = await userNames(rows.map((r) => r.createdById));
    return ok(res, rows.map((r) => ({ ...r, createdByName: names.get(r.createdById) || null })));
  }));
  router.post('/:id/notes', authorize('clients.read'), validate({ params: z.object({ id }), body: z.object({ type: z.enum(['note', 'call', 'meeting', 'email', 'site_visit', 'whatsapp']).optional(), note: z.string().min(1).max(5000) }) }), h(async (req, res) => {
    await clientOr404(req.params.id);
    const row = await prisma.clientNote.create({ data: { clientId: req.params.id, type: req.body.type || 'note', note: req.body.note, createdById: req.user.id } });
    return created(res, row);
  }));
  router.delete('/:id/notes/:noteId', authorize('clients.read'), validate({ params: z.object({ id, noteId: id }) }), h(async (req, res) => {
    const row = await prisma.clientNote.findUnique({ where: { id: req.params.noteId } });
    if (!row || row.clientId !== req.params.id) throw AppError.notFound('Note not found');
    if (row.createdById !== req.user.id && !hasPerm(req.user, 'clients.update')) throw AppError.forbidden('Only the author or a client manager can delete this note');
    await prisma.clientNote.delete({ where: { id: row.id } });
    return ok(res, { success: true });
  }));
}

module.exports = { registerClientExtras };
