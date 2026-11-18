'use strict';

/**
 * Finance extensions: installment schedules, collection summaries (project &
 * client-wise), payment receipts and monthly/yearly expense reports.
 */
const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const asyncHandler = require('../../core/http/asyncHandler');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const { ok, created } = require('../../core/http/response');
const { projectCollections, totals } = require('../../core/services/collections');
const { accessibleProjectIds } = require('../../core/services/access');
const { getTemplate, renderDocument } = require('../../core/constants/documentTemplates');

const id = z.coerce.number().int().positive();
const num = (v) => Number(v || 0);
const r2 = (n) => Math.round(n * 100) / 100;

const scheduleSchema = z.object({ projectId: id, title: z.string().min(1).max(150), dueDate: z.coerce.date(), amount: z.coerce.number().positive(), sortOrder: z.coerce.number().int().optional() });
const scheduleUpdate = z.object({ title: z.string().min(1).max(150).optional(), dueDate: z.coerce.date().optional(), amount: z.coerce.number().positive().optional(), sortOrder: z.coerce.number().int().optional() }).refine((d) => Object.keys(d).length, { message: 'No fields to update' });
const bulkSchema = z.object({ projectId: id, items: z.array(z.object({ title: z.string().min(1).max(150), dueDate: z.coerce.date(), amount: z.coerce.number().positive() })).min(1).max(60), replace: z.boolean().optional() });

// Words for receipts (Indian numbering).
function amountInWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (x) => (x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? ` ${a[x % 10]}` : ''}`);
  const three = (x) => `${x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? ' ' : ''}` : ''}${x % 100 ? two(x % 100) : ''}`;
  let rupees = Math.floor(n);
  const paise = Math.round((n - rupees) * 100);
  if (!rupees && !paise) return 'Zero';
  const parts = [];
  const crore = Math.floor(rupees / 10000000); rupees %= 10000000;
  const lakh = Math.floor(rupees / 100000); rupees %= 100000;
  const thousand = Math.floor(rupees / 1000); rupees %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (rupees) parts.push(three(rupees));
  return `${parts.join(' ')}${paise ? ` and ${two(paise)} Paise` : ''} Only`;
}

async function scopedWhere(actor) {
  const ids = await accessibleProjectIds(actor);
  return ids === null ? {} : { id: { in: ids } };
}

function registerFinanceExtras(router) {
  const read = authorize('finance.read');
  const write = authorize('finance.update', 'finance.create');
  const h = (fn) => asyncHandler(fn);

  // --- installment schedules ---
  router.get('/projects/:projectId/schedule', read, validate({ params: z.object({ projectId: id }) }), h(async (req, res) => {
    const [row] = await projectCollections({ id: req.params.projectId, ...(await scopedWhere(req.user)) });
    if (!row) throw AppError.notFound('Project not found');
    return ok(res, row);
  }));
  router.post('/schedules', write, validate({ body: scheduleSchema }), h(async (req, res) => {
    const row = await prisma.paymentSchedule.create({ data: { ...req.body, amount: new Prisma.Decimal(req.body.amount) } });
    activity.record({ userId: req.user.id, action: 'finance.schedule_added', entityType: 'project', entityId: req.body.projectId, req });
    return created(res, row);
  }));
  // Replace / append a whole plan in one go (e.g. "10 monthly installments").
  router.post('/schedules/bulk', write, validate({ body: bulkSchema }), h(async (req, res) => {
    const { projectId, items, replace } = req.body;
    await prisma.$transaction([
      ...(replace ? [prisma.paymentSchedule.deleteMany({ where: { projectId } })] : []),
      prisma.paymentSchedule.createMany({ data: items.map((it, i) => ({ projectId, title: it.title, dueDate: it.dueDate, amount: new Prisma.Decimal(it.amount), sortOrder: i })) }),
    ]);
    activity.record({ userId: req.user.id, action: 'finance.schedule_planned', entityType: 'project', entityId: projectId, req });
    return created(res, { count: items.length });
  }));
  router.patch('/schedules/:id', write, validate({ params: z.object({ id }), body: scheduleUpdate }), h(async (req, res) => {
    const data = { ...req.body };
    if (data.amount !== undefined) data.amount = new Prisma.Decimal(data.amount);
    return ok(res, await prisma.paymentSchedule.update({ where: { id: req.params.id }, data }));
  }));
  router.delete('/schedules/:id', write, validate({ params: z.object({ id }) }), h(async (req, res) => {
    await prisma.paymentSchedule.delete({ where: { id: req.params.id } });
    return ok(res, { success: true });
  }));

  // --- collections summary (project-wise or client-wise) ---
  router.get('/collections', read, validate({ query: z.object({ groupBy: z.enum(['project', 'client']).optional(), clientName: z.string().optional() }) }), h(async (req, res) => {
    const where = { ...(await scopedWhere(req.user)), ...(req.query.clientName ? { clientName: req.query.clientName } : {}) };
    const rows = (await projectCollections(where)).map(({ installments, ...r }) => r);
    if (req.query.groupBy === 'client') {
      const map = new Map();
      for (const r of rows) {
        const c = map.get(r.clientName) || { clientName: r.clientName, projects: 0, value: 0, received: 0, outstanding: 0, overdueAmount: 0, lastPaymentDate: null };
        c.projects += 1; c.value += r.value; c.received += r.received; c.outstanding += r.outstanding; c.overdueAmount += r.overdueAmount;
        if (r.lastPaymentDate && (!c.lastPaymentDate || r.lastPaymentDate > c.lastPaymentDate)) c.lastPaymentDate = r.lastPaymentDate;
        map.set(r.clientName, c);
      }
      const clients = [...map.values()].map((c) => ({ ...c, value: r2(c.value), received: r2(c.received), outstanding: r2(c.outstanding), overdueAmount: r2(c.overdueAmount) })).sort((a, b) => b.outstanding - a.outstanding);
      return ok(res, { rows: clients, totals: totals(rows) });
    }
    return ok(res, { rows: rows.sort((a, b) => b.overdueAmount - a.overdueAmount || b.outstanding - a.outstanding), totals: totals(rows) });
  }));

  // --- payment receipt (print / PDF) ---
  router.get('/payments/:id/receipt', read, validate({ params: z.object({ id }) }), h(async (req, res) => {
    const p = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!p) throw AppError.notFound('Payment not found');
    const [project, company] = await Promise.all([
      prisma.project.findUnique({ where: { id: p.projectId }, select: { name: true, clientName: true, referenceNumber: true } }),
      prisma.company.findFirst(),
    ]);
    const amount = num(p.amount);
    const data = {
      reference: `RCPT-${String(p.id).padStart(5, '0')}`,
      date: p.date,
      receivedFrom: project?.clientName || '',
      amount,
      amountWords: `Rupees ${amountInWords(amount)}`,
      towards: `${project?.name || ''}${project?.referenceNumber ? ` (${project.referenceNumber})` : ''}${p.notes ? ` — ${p.notes}` : ''}`,
      mode: p.method,
    };
    const branding = (await prisma.setting.findUnique({ where: { group_key: { group: 'documents', key: 'branding' } } }))?.value || {};
    return ok(res, { html: renderDocument(getTemplate('receipt'), data, company || {}, branding) });
  }));

  // --- expense reports: month x category for a year ---
  router.get('/reports/expenses', read, validate({ query: z.object({ year: z.coerce.number().int().min(2000).max(2100).optional(), scope: z.enum(['PROJECT', 'COMPANY']).optional(), projectId: id.optional() }) }), h(async (req, res) => {
    const year = req.query.year || new Date().getFullYear();
    const where = { date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } };
    if (req.query.scope) where.scope = req.query.scope;
    if (req.query.projectId) where.projectId = req.query.projectId;
    const rows = await prisma.expense.findMany({ where, select: { amount: true, date: true, category: true, projectId: true, scope: true } });
    const months = Array.from({ length: 12 }, () => 0);
    const cats = new Map();
    const projects = new Map();
    for (const e of rows) {
      const m = new Date(e.date).getUTCMonth();
      const a = num(e.amount);
      months[m] += a;
      const c = cats.get(e.category) || Array.from({ length: 12 }, () => 0);
      c[m] += a;
      cats.set(e.category, c);
      if (e.projectId) projects.set(e.projectId, (projects.get(e.projectId) || 0) + a);
    }
    const names = await prisma.project.findMany({ where: { id: { in: [...projects.keys()] } }, select: { id: true, name: true } });
    const nm = new Map(names.map((p) => [p.id, p.name]));
    // Previous-year total for comparison.
    const prev = await prisma.expense.aggregate({ where: { ...where, date: { gte: new Date(Date.UTC(year - 1, 0, 1)), lt: new Date(Date.UTC(year, 0, 1)) } }, _sum: { amount: true } });
    return ok(res, {
      year,
      months: months.map(r2),
      total: r2(months.reduce((s, v) => s + v, 0)),
      previousYearTotal: r2(num(prev._sum.amount)),
      categories: [...cats.entries()].map(([category, m]) => ({ category, months: m.map(r2), total: r2(m.reduce((s, v) => s + v, 0)) })).sort((a, b) => b.total - a.total),
      projects: [...projects.entries()].map(([pid, total]) => ({ projectId: pid, projectName: nm.get(pid) || `#${pid}`, total: r2(total) })).sort((a, b) => b.total - a.total),
    });
  }));
}

module.exports = { registerFinanceExtras, amountInWords };
