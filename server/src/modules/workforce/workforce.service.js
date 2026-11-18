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
    if (query.workerType === 'CONTRACTOR') where.workerType = { in: ['CONTRACTOR', 'SUBCONTRACTOR'] };
    else if (query.workerType) where.workerType = query.workerType;
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
    out.contracts = await this.contracts(id);
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

  // Contracts with paid / outstanding (payments = expenses tagged to the contract).
  async contracts(workforceId) {
    const rows = await prisma.workContract.findMany({ where: { workforceId, deletedAt: null }, orderBy: [{ status: 'asc' }, { id: 'desc' }] });
    if (!rows.length) return [];
    const paid = await prisma.expense.groupBy({ by: ['workContractId'], where: { workContractId: { in: rows.map((r) => r.id) } }, _sum: { amountPaid: true } });
    const pm = new Map(paid.map((p) => [p.workContractId, num(p._sum.amountPaid)]));
    const names = await projectNames(rows.map((r) => r.projectId));
    return rows.map((r) => {
      const amount = num(r.amount);
      const p = pm.get(r.id) || 0;
      const retention = Math.round(amount * num(r.retentionPercent)) / 100;
      return { ...r, amount, retentionPercent: num(r.retentionPercent), projectName: r.projectId ? names.get(r.projectId)?.name || null : null, paid: p, retention, outstanding: Math.max(0, Math.round((amount - p) * 100) / 100), payableNow: Math.max(0, Math.round((amount - retention - p) * 100) / 100), progressPct: amount ? Math.min(100, Math.round((p / amount) * 100)) : 0 };
    });
  },

  async saveContract(workforceId, payload, actor, req, contractId) {
    const member = await repo.findById(workforceId);
    if (!member) throw AppError.notFound('Workforce member not found');
    const data = {
      projectId: payload.projectId ?? null, title: payload.title, amount: payload.amount, retentionPercent: payload.retentionPercent ?? 0,
      startDate: payload.startDate ?? null, endDate: payload.endDate ?? null, notes: payload.notes ?? null,
      ...(payload.status ? { status: payload.status } : {}),
    };
    const row = contractId
      ? await prisma.workContract.update({ where: { id: contractId }, data })
      : await prisma.workContract.create({ data: { ...data, workforceId, createdById: actor.id } });
    activity.record({ userId: actor.id, action: contractId ? 'work_contract.updated' : 'work_contract.created', entityType: 'workforce', entityId: workforceId, req });
    return row;
  },

  async removeContract(contractId, actor, req) {
    const c = await prisma.workContract.findFirst({ where: { id: contractId, deletedAt: null } });
    if (!c) throw AppError.notFound('Contract not found');
    await prisma.workContract.update({ where: { id: contractId }, data: { deletedAt: new Date() } });
    activity.record({ userId: actor.id, action: 'work_contract.deleted', entityType: 'workforce', entityId: c.workforceId, req });
    return { success: true };
  },

  // Labour cost per project: man-days from attendance (× daily rate where
  // known) and money actually paid to workforce members against the project.
  async projectCosts(actor, query) {
    const { accessibleProjectIds } = require('../../core/services/access');
    const allowed = await accessibleProjectIds(actor);
    const dateWhere = query.month ? (() => { const [y, m] = query.month.split('-').map(Number); return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) }; })() : undefined;
    const [att, profiles, paid, contracts] = await Promise.all([
      prisma.attendanceRecord.findMany({ where: { personType: 'WORKFORCE', projectId: { not: null }, status: { in: ['present', 'half_day'] }, ...(dateWhere ? { date: dateWhere } : {}) }, select: { personId: true, projectId: true, status: true } }),
      prisma.salaryProfile.findMany({ where: { personType: 'WORKFORCE', active: true, payType: 'daily' } }),
      prisma.expense.groupBy({ by: ['projectId'], where: { workforceId: { not: null }, projectId: { not: null }, ...(dateWhere ? { date: dateWhere } : {}) }, _sum: { amountPaid: true } }),
      prisma.workContract.groupBy({ by: ['projectId'], where: { deletedAt: null, projectId: { not: null }, status: { not: 'cancelled' } }, _sum: { amount: true } }),
    ]);
    const rate = new Map(profiles.map((p) => [p.personId, num(p.rate)]));
    const by = new Map();
    const row = (pid) => by.get(pid) || { projectId: pid, manDays: 0, wageCost: 0, paid: 0, contracted: 0, workers: new Set() };
    for (const a of att) {
      const r = row(a.projectId);
      const w = a.status === 'half_day' ? 0.5 : 1;
      r.manDays += w;
      r.wageCost += w * (rate.get(a.personId) || 0);
      r.workers.add(a.personId);
      by.set(a.projectId, r);
    }
    for (const p of paid) { const r = row(p.projectId); r.paid += num(p._sum.amountPaid); by.set(p.projectId, r); }
    for (const c of contracts) { const r = row(c.projectId); r.contracted += num(c._sum.amount); by.set(c.projectId, r); }
    const ids = [...by.keys()].filter((pid) => allowed === null || allowed.includes(pid));
    const names = await projectNames(ids);
    return ids.map((pid) => {
      const r = by.get(pid);
      return { projectId: pid, projectName: names.get(pid)?.name || `Project #${pid}`, manDays: r.manDays, workers: r.workers.size, wageCost: Math.round(r.wageCost), contracted: Math.round(r.contracted), paid: Math.round(r.paid) };
    }).sort((a, b) => b.paid + b.wageCost - (a.paid + a.wageCost));
  },

  async stats(actor) {
    const where = { deletedAt: null, status: 'ACTIVE' };
    const [labour, contractors] = await Promise.all([
      prisma.workforce.count({ where: { ...where, workerType: 'LABOUR' } }),
      prisma.workforce.count({ where: { ...where, workerType: { in: ['CONTRACTOR', 'SUBCONTRACTOR'] } } }),
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
