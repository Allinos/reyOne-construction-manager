'use strict';

const repo = require('./workforce.repository');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { getPagination, buildMeta } = require('../../core/utils/pagination');
const prisma = require('../../config/prisma');
const { hasPerm } = require('../../core/services/access');
const { projectNames } = require('../../core/services/people');

const num = (v) => Number(v || 0);
const monthStart = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)); };

const workforceService = {
  async list(query, actor) {
    const { page, limit, skip, take } = getPagination(query, { defaultLimit: 30 });
    const where = { deletedAt: null };
    if (query.category) where.category = query.category;
    if (query.status) where.status = query.status;
    if (query.workerType) where.workerType = query.workerType;
    if (query.siteProjectId) where.siteProjectId = query.siteProjectId;
    if (query.search) {
      where.OR = [{ name: { contains: query.search } }, { phone: { contains: query.search } }, { firmName: { contains: query.search } }];
    }
    const orderBy = { [query.sortBy || 'name']: query.order || 'asc' };
    const { rows, total } = await repo.list({ where, skip, take, orderBy });
    const sites = await projectNames(rows.map((r) => r.siteProjectId));
    let data = rows.map((r) => ({ ...r, siteName: r.siteProjectId ? sites.get(r.siteProjectId)?.name || null : null }));
    // Wage + dues columns for people allowed to see payroll.
    if (actor && hasPerm(actor, 'payroll.read') && rows.length) {
      const payroll = require('../payroll/payroll.service');
      const ledgers = await payroll.ledgers(rows.map((r) => ({ personType: 'WORKFORCE', personId: r.id })));
      data = data.map((r) => {
        const l = ledgers.get(`WORKFORCE:${r.id}`);
        return { ...r, payType: l?.profile?.payType || null, rate: l?.profile ? num(l.profile.rate) : null, pendingDues: l?.totals.pending || 0, advanceOutstanding: l?.totals.advanceOutstanding || 0 };
      });
    }
    return { data, meta: buildMeta(page, limit, total) };
  },

  // Everything about one worker / contractor on one screen: attendance,
  // wages & dues (payroll.read), and payments made (finance.read).
  async overview(id, actor) {
    const member = await repo.findById(id);
    if (!member) throw AppError.notFound('Workforce member not found');
    const ref = { personType: 'WORKFORCE', personId: id };
    const since = monthStart();
    const [att, lastAtt] = await Promise.all([
      prisma.attendanceRecord.groupBy({ by: ['status'], where: { ...ref, date: { gte: since } }, _count: { _all: true } }),
      prisma.attendanceRecord.findMany({ where: { ...ref, projectId: { not: null } }, orderBy: { date: 'desc' }, take: 1, select: { projectId: true, date: true } }),
    ]);
    const counts = { present: 0, half_day: 0, absent: 0, leave: 0 };
    for (const a of att) counts[a.status] = a._count._all;
    const names = await projectNames([member.siteProjectId, lastAtt[0]?.projectId]);
    const out = {
      member: { ...member, siteName: member.siteProjectId ? names.get(member.siteProjectId)?.name || null : null },
      attendance: { month: since.toISOString().slice(0, 7), ...counts, daysWorked: counts.present + counts.half_day * 0.5, lastSite: lastAtt[0] ? { name: names.get(lastAtt[0].projectId)?.name || null, date: lastAtt[0].date } : null },
      wages: null,
      payments: null,
    };
    if (hasPerm(actor, 'payroll.read')) {
      const payroll = require('../payroll/payroll.service');
      const l = await payroll.ledger(ref);
      out.wages = { profile: l.profile, totals: l.totals, months: l.months.slice(0, 6), advances: l.advances.slice(0, 10) };
    }
    if (hasPerm(actor, 'finance.read')) {
      const rows = await prisma.expense.findMany({ where: { workforceId: id }, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 50, select: { id: true, date: true, amount: true, amountPaid: true, category: true, method: true, notes: true, projectId: true, scope: true } });
      const pn = await projectNames(rows.map((r) => r.projectId));
      const all = await prisma.expense.aggregate({ where: { workforceId: id }, _sum: { amountPaid: true } });
      const month = await prisma.expense.aggregate({ where: { workforceId: id, date: { gte: since } }, _sum: { amountPaid: true } });
      out.payments = {
        totalPaid: num(all._sum.amountPaid),
        paidThisMonth: num(month._sum.amountPaid),
        items: rows.map((r) => ({ ...r, amount: num(r.amount), amountPaid: num(r.amountPaid), projectName: r.projectId ? pn.get(r.projectId)?.name || null : null })),
      };
    }
    return out;
  },

  async stats(actor) {
    const where = { deletedAt: null, status: 'ACTIVE' };
    const [labour, contractors] = await Promise.all([
      prisma.workforce.count({ where: { ...where, workerType: 'LABOUR' } }),
      prisma.workforce.count({ where: { ...where, workerType: 'CONTRACTOR' } }),
    ]);
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const presentToday = await prisma.attendanceRecord.count({ where: { personType: 'WORKFORCE', date: today, status: { in: ['present', 'half_day'] } } });
    const out = { labour, contractors, presentToday, pendingDues: null, paidThisMonth: null };
    if (hasPerm(actor, 'payroll.read')) {
      const payroll = require('../payroll/payroll.service');
      const s = await payroll.summary({ type: 'WORKFORCE' });
      out.pendingDues = s.totals.totalPending;
    }
    if (hasPerm(actor, 'finance.read')) {
      const agg = await prisma.expense.aggregate({ where: { workforceId: { not: null }, date: { gte: monthStart() } }, _sum: { amountPaid: true } });
      out.paidThisMonth = num(agg._sum.amountPaid);
    }
    return out;
  },

  async get(id) {
    const member = await repo.findById(id);
    if (!member) throw AppError.notFound('Workforce member not found');
    return member;
  },

  async create(payload, actor, req) {
    const member = await repo.create(payload);
    activity.record({ userId: actor.id, action: 'workforce.created', entityType: 'workforce', entityId: member.id, req });
    return member;
  },

  async update(id, payload, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Workforce member not found');
    const member = await repo.update(id, payload);
    activity.record({ userId: actor.id, action: 'workforce.updated', entityType: 'workforce', entityId: id, req });
    return member;
  },

  async remove(id, actor, req) {
    const existing = await repo.findById(id);
    if (!existing) throw AppError.notFound('Workforce member not found');
    await repo.softDelete(id);
    activity.record({ userId: actor.id, action: 'workforce.deleted', entityType: 'workforce', entityId: id, req });
    return { success: true };
  },
};

module.exports = workforceService;
