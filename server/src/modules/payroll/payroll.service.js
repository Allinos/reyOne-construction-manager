'use strict';

const { Prisma } = require('@prisma/client');
const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { listPeople, resolvePeople, keyOf, userNames } = require('../../core/services/people');
const { getPagination, buildMeta } = require('../../core/utils/pagination');

const D = (v) => new Prisma.Decimal(v || 0);
const num = (v) => Number(v || 0);
const round2 = (n) => Math.round(n * 100) / 100;
const WEIGHT = { present: 1, half_day: 0.5, absent: 0, leave: 0 };

const ym = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}
// List of YYYY-MM from `from` to `to` inclusive (max `cap` months, latest kept).
function monthsBetween(from, to, cap = 24) {
  const out = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out.slice(-cap);
}
const currentMonth = () => ym(new Date());

async function getSetting(group, key, fallback) {
  const row = await prisma.setting.findUnique({ where: { group_key: { group, key } } });
  return row ? row.value : fallback;
}

// Best-effort: mirror cash outflows into Finance as company expenses so salary
// shows up in expense totals. Never fails the payroll write.
async function mirrorExpense({ amount, date, method, category, notes, personType, personId, actor }) {
  if (!(num(amount) > 0)) return null;
  try {
    const accounts = await getSetting('finance', 'accounts', []);
    const acc = Array.isArray(accounts) && accounts[0] ? accounts[0].key || accounts[0] : 'cash';
    const exp = await prisma.expense.create({
      data: {
        scope: 'COMPANY',
        category,
        amount: D(amount),
        amountPaid: D(amount),
        date,
        method: method || 'Cash',
        account: acc,
        workforceId: personType === 'WORKFORCE' ? personId : null,
        notes,
        createdById: actor.id,
      },
    });
    return exp.id;
  } catch {
    return null; /* best-effort */
  }
}
async function dropExpense(id) {
  if (!id) return;
  await prisma.expense.delete({ where: { id } }).catch(() => {});
}

// Core money math for a set of people over a window of months.
async function computeLedgers(refs, upToMonth) {
  if (!refs.length) return new Map();
  const or = refs.map((r) => ({ personType: r.personType, personId: r.personId }));
  const [profiles, payments, advances] = await Promise.all([
    prisma.salaryProfile.findMany({ where: { OR: or } }),
    prisma.salaryPayment.findMany({ where: { OR: or, deletedAt: null } }),
    prisma.salaryAdvance.findMany({ where: { OR: or, deletedAt: null } }),
  ]);
  const profByKey = new Map(profiles.map((p) => [keyOf(p.personType, p.personId), p]));

  // Earliest month we need attendance for (daily-wage people only).
  const startOf = (p) => (p.effectiveFrom ? ym(p.effectiveFrom) : ym(p.createdAt));
  const dailyRefs = profiles.filter((p) => p.payType === 'daily' && p.active);
  let attendance = [];
  if (dailyRefs.length) {
    const earliest = dailyRefs.map(startOf).sort()[0];
    const window = monthsBetween(earliest, upToMonth);
    attendance = await prisma.attendanceRecord.findMany({
      where: {
        OR: dailyRefs.map((p) => ({ personType: p.personType, personId: p.personId })),
        date: { gte: monthRange(window[0]).gte, lt: monthRange(upToMonth).lt },
      },
      select: { personType: true, personId: true, date: true, status: true },
    });
  }
  const daysByKeyMonth = new Map();
  for (const a of attendance) {
    const k = `${keyOf(a.personType, a.personId)}|${ym(a.date)}`;
    daysByKeyMonth.set(k, (daysByKeyMonth.get(k) || 0) + (WEIGHT[a.status] || 0));
  }

  const out = new Map();
  for (const r of refs) {
    const k = keyOf(r.personType, r.personId);
    const profile = profByKey.get(k) || null;
    const pays = payments.filter((p) => keyOf(p.personType, p.personId) === k);
    const advs = advances.filter((a) => keyOf(a.personType, a.personId) === k);
    const advanceGiven = advs.reduce((s, a) => s + num(a.amount), 0);
    const advanceRecovered = pays.reduce((s, p) => s + num(p.advanceDeduction), 0);

    const months = [];
    if (profile) {
      for (const m of monthsBetween(startOf(profile), upToMonth)) {
        const days = daysByKeyMonth.get(`${k}|${m}`) || 0;
        const earned = !profile.active ? 0 : profile.payType === 'daily' ? num(profile.rate) * days : num(profile.rate);
        const settled = pays.filter((p) => p.period === m).reduce((s, p) => s + num(p.grossAmount), 0);
        months.push({ month: m, days, earned: round2(earned), settled: round2(settled), pending: round2(Math.max(0, earned - settled)) });
      }
    }
    out.set(k, {
      profile,
      months,
      totals: {
        earned: round2(months.reduce((s, m) => s + m.earned, 0)),
        settled: round2(months.reduce((s, m) => s + m.settled, 0)),
        pending: round2(months.reduce((s, m) => s + m.pending, 0)),
        netPaidAllTime: round2(pays.reduce((s, p) => s + num(p.netPaid), 0)),
        advanceGiven: round2(advanceGiven),
        advanceRecovered: round2(advanceRecovered),
        advanceOutstanding: round2(Math.max(0, advanceGiven - advanceRecovered)),
      },
    });
  }
  return out;
}

const payrollService = {
  // Ledgers for many people at once (used by Workforce lists).
  ledgers(refs) {
    return computeLedgers(refs, currentMonth());
  },

  // People + their salary profile (for the Salary Setup tab).
  async profiles(query) {
    const people = await listPeople({ type: query.type });
    const profiles = await prisma.salaryProfile.findMany();
    const byKey = new Map(profiles.map((p) => [keyOf(p.personType, p.personId), p]));
    return people.map((p) => ({ ...p, profile: byKey.get(p.key) || null }));
  },

  async saveProfile(payload, actor, req) {
    const where = { personType_personId: { personType: payload.personType, personId: payload.personId } };
    const data = {
      payType: payload.payType,
      rate: D(payload.rate),
      effectiveFrom: payload.effectiveFrom ?? null,
      notes: payload.notes ?? null,
      active: payload.active ?? true,
    };
    const row = await prisma.salaryProfile.upsert({
      where,
      update: data,
      create: { personType: payload.personType, personId: payload.personId, ...data },
    });
    // Mirror a monthly salary back onto the user record (shown in User Management).
    if (payload.personType === 'USER') {
      await prisma.user.update({
        where: { id: payload.personId },
        data: { salary: payload.payType === 'monthly' && data.active ? data.rate : null },
      }).catch(() => {});
    }
    activity.record({ userId: actor.id, action: 'payroll.profile_saved', entityType: 'salary_profile', entityId: row.id, req });
    return row;
  },

  // Month view: everyone with a profile (or an open advance).
  async summary(query) {
    const month = query.month || currentMonth();
    const [profiles, advPeople] = await Promise.all([
      prisma.salaryProfile.findMany({ select: { personType: true, personId: true } }),
      prisma.salaryAdvance.findMany({ where: { deletedAt: null }, distinct: ['personType', 'personId'], select: { personType: true, personId: true } }),
    ]);
    const seen = new Set();
    const refs = [...profiles, ...advPeople].filter((r) => {
      const k = keyOf(r.personType, r.personId);
      if (seen.has(k)) return false;
      seen.add(k);
      return !query.type || r.personType === query.type;
    });
    const [ledgers, names] = await Promise.all([computeLedgers(refs, month), resolvePeople(refs)]);
    const rows = refs.map((r) => {
      const k = keyOf(r.personType, r.personId);
      const l = ledgers.get(k);
      const m = l.months.find((x) => x.month === month) || { days: 0, earned: 0, settled: 0, pending: 0 };
      return {
        ...r,
        key: k,
        ...(names.get(k) || { name: 'Unknown' }),
        payType: l.profile?.payType || null,
        rate: l.profile ? num(l.profile.rate) : 0,
        active: l.profile?.active ?? false,
        days: m.days,
        earned: m.earned,
        settled: m.settled,
        pending: m.pending,
        totalPending: l.totals.pending, // cumulative up to this month
        advanceOutstanding: l.totals.advanceOutstanding,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
    const sum = (f) => round2(rows.reduce((s, r) => s + r[f], 0));
    return {
      month,
      rows,
      totals: {
        earned: sum('earned'),
        settled: sum('settled'),
        pending: sum('pending'),
        totalPending: sum('totalPending'),
        advanceOutstanding: sum('advanceOutstanding'),
        people: rows.length,
      },
    };
  },

  async ledger(query) {
    const ref = { personType: query.personType, personId: query.personId };
    const k = keyOf(ref.personType, ref.personId);
    const [ledgers, names, payments, advances] = await Promise.all([
      computeLedgers([ref], currentMonth()),
      resolvePeople([ref]),
      prisma.salaryPayment.findMany({ where: { ...ref, deletedAt: null }, orderBy: { date: 'desc' } }),
      prisma.salaryAdvance.findMany({ where: { ...ref, deletedAt: null }, orderBy: { date: 'desc' } }),
    ]);
    const l = ledgers.get(k);
    return { person: { ...ref, ...(names.get(k) || { name: 'Unknown' }) }, profile: l.profile, months: l.months.slice().reverse(), totals: l.totals, payments, advances };
  },

  async listPayments(query) {
    const { page, limit, skip, take } = getPagination(query);
    const where = { deletedAt: null };
    if (query.personType) where.personType = query.personType;
    if (query.personId) where.personId = query.personId;
    if (query.period) where.period = query.period;
    const [rows, total] = await Promise.all([
      prisma.salaryPayment.findMany({ where, skip, take, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
      prisma.salaryPayment.count({ where }),
    ]);
    const names = await resolvePeople(rows);
    const creators = await userNames(rows.map((r) => r.createdById));
    return {
      data: rows.map((r) => ({ ...r, personName: names.get(keyOf(r.personType, r.personId))?.name || 'Unknown', createdByName: creators.get(r.createdById) || null })),
      meta: buildMeta(page, limit, total),
    };
  },

  async createPayment(payload, actor, req) {
    const ref = { personType: payload.personType, personId: payload.personId };
    const k = keyOf(ref.personType, ref.personId);
    const l = (await computeLedgers([ref], currentMonth())).get(k);
    const advanceDeduction = num(payload.advanceDeduction);
    if (advanceDeduction > l.totals.advanceOutstanding + 0.001) {
      throw AppError.badRequest(`Advance deduction exceeds outstanding advance (${l.totals.advanceOutstanding})`);
    }
    const netPaid = round2(num(payload.grossAmount) + num(payload.bonus) - advanceDeduction - num(payload.otherDeduction));
    if (netPaid < 0) throw AppError.badRequest('Deductions exceed the amount being paid');

    const row = await prisma.salaryPayment.create({
      data: {
        ...ref,
        period: payload.period,
        grossAmount: D(payload.grossAmount),
        advanceDeduction: D(advanceDeduction),
        otherDeduction: D(payload.otherDeduction),
        bonus: D(payload.bonus),
        netPaid: D(netPaid),
        date: payload.date || new Date(),
        method: payload.method || null,
        notes: payload.notes || null,
        createdById: actor.id,
      },
    });
    activity.record({ userId: actor.id, action: 'payroll.payment_recorded', entityType: 'salary_payment', entityId: row.id, req });
    if (payload.addToExpenses !== false) {
      const name = (await resolvePeople([ref])).get(k)?.name || '';
      const expenseId = await mirrorExpense({ amount: netPaid, date: row.date, method: row.method, category: 'Salary', notes: `Salary ${payload.period} — ${name}`, ...ref, actor });
      if (expenseId) return prisma.salaryPayment.update({ where: { id: row.id }, data: { expenseId } });
    }
    return row;
  },

  async removePayment(id, actor, req) {
    const row = await prisma.salaryPayment.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppError.notFound('Payment not found');
    await prisma.salaryPayment.update({ where: { id }, data: { deletedAt: new Date() } });
    await dropExpense(row.expenseId);
    activity.record({ userId: actor.id, action: 'payroll.payment_deleted', entityType: 'salary_payment', entityId: id, req });
    return { success: true };
  },

  async listAdvances(query) {
    const where = { deletedAt: null };
    if (query.personType) where.personType = query.personType;
    if (query.personId) where.personId = query.personId;
    const rows = await prisma.salaryAdvance.findMany({ where, orderBy: [{ date: 'desc' }, { id: 'desc' }], take: 200 });
    const names = await resolvePeople(rows);
    return rows.map((r) => ({ ...r, personName: names.get(keyOf(r.personType, r.personId))?.name || 'Unknown' }));
  },

  async createAdvance(payload, actor, req) {
    const ref = { personType: payload.personType, personId: payload.personId };
    const row = await prisma.salaryAdvance.create({
      data: { ...ref, amount: D(payload.amount), date: payload.date || new Date(), method: payload.method || null, notes: payload.notes || null, createdById: actor.id },
    });
    activity.record({ userId: actor.id, action: 'payroll.advance_given', entityType: 'salary_advance', entityId: row.id, req });
    if (payload.addToExpenses !== false) {
      const name = (await resolvePeople([ref])).get(keyOf(ref.personType, ref.personId))?.name || '';
      const expenseId = await mirrorExpense({ amount: payload.amount, date: row.date, method: row.method, category: 'Salary Advance', notes: `Advance — ${name}`, ...ref, actor });
      if (expenseId) return prisma.salaryAdvance.update({ where: { id: row.id }, data: { expenseId } });
    }
    return row;
  },

  async removeAdvance(id, actor, req) {
    const row = await prisma.salaryAdvance.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw AppError.notFound('Advance not found');
    await prisma.salaryAdvance.update({ where: { id }, data: { deletedAt: new Date() } });
    await dropExpense(row.expenseId);
    activity.record({ userId: actor.id, action: 'payroll.advance_deleted', entityType: 'salary_advance', entityId: id, req });
    return { success: true };
  },
};

module.exports = payrollService;
