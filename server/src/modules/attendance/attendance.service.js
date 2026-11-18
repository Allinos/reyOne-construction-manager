'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { listPeople, resolvePeople, keyOf, projectNames } = require('../../core/services/people');
const { assertProjectAccess } = require('../../core/services/access');

const STATUSES = ['present', 'absent', 'half_day', 'leave'];
const { setting } = require('../../core/services/policy');
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Attendance rules from Settings → Attendance.
async function rules() {
  const [start, grace, weeklyOff, selfCheckin] = await Promise.all([
    setting('attendance', 'work_start', '09:30'),
    setting('attendance', 'grace_minutes', 15),
    setting('attendance', 'weekly_off', ['Sunday']),
    setting('attendance', 'self_checkin', false),
  ]);
  return { workStart: start || '09:30', graceMinutes: Number(grace) || 0, weeklyOff: Array.isArray(weeklyOff) ? weeklyOff : [], selfCheckin: !!selfCheckin };
}
const mins = (hhmm) => { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const isLate = (checkIn, r) => { const a = mins(checkIn); const b = mins(r.workStart); return a !== null && b !== null && a > b + r.graceMinutes; };
const nowHHMM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

// "YYYY-MM-DD" -> Date at UTC midnight (matches @db.Date storage).
function toDay(str) {
  const d = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw AppError.badRequest('Invalid date');
  return d;
}
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) };
}
// Worked-day weight per status (used by payroll for daily wages too).
const WEIGHT = { present: 1, half_day: 0.5, absent: 0, leave: 0 };

const attendanceService = {
  STATUSES,
  WEIGHT,
  monthRange,

  people(query) {
    return listPeople({ type: query.type });
  },

  // Everyone with their status for the day (blank when not marked yet).
  async day(query) {
    const date = toDay(query.date);
    const r = await rules();
    const [people, records] = await Promise.all([
      listPeople({ type: query.type }),
      prisma.attendanceRecord.findMany({ where: { date } }),
    ]);
    const byKey = new Map(records.map((r) => [keyOf(r.personType, r.personId), r]));
    const projects = await projectNames(records.map((r) => r.projectId));
    const rl = r;
    let rows = people.map((p) => {
      const r = byKey.get(p.key);
      return {
        ...p,
        status: r?.status || '',
        checkIn: r?.checkIn || '',
        checkOut: r?.checkOut || '',
        notes: r?.notes || '',
        late: !!(r?.checkIn && isLate(r.checkIn, rl)),
        projectId: r?.projectId || null,
        projectName: r?.projectId ? projects.get(r.projectId)?.name || null : null,
      };
    });
    if (query.projectId) rows = rows.filter((r) => !r.status || r.projectId === Number(query.projectId));
    const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: rows.filter((r) => r.status === s).length }), {});
    counts.unmarked = rows.filter((x) => !x.status).length;
    counts.late = rows.filter((x) => x.late).length;
    const weekday = DAY_NAMES[new Date(`${query.date}T12:00:00Z`).getUTCDay()];
    return { date: query.date, rows, counts, rules: r, weeklyOff: r.weeklyOff.includes(weekday) };
  },

  // Bulk upsert a day's sheet. An empty status clears the record.
  async saveDay(payload, actor, req) {
    const date = toDay(payload.date);
    if (payload.projectId) await assertProjectAccess(actor, payload.projectId);
    let saved = 0;
    let cleared = 0;
    // Labour without an explicit site is booked to their assigned site.
    const wfIds = payload.entries.filter((e) => e.personType === 'WORKFORCE').map((e) => e.personId);
    const wfSites = new Map(
      wfIds.length ? (await prisma.workforce.findMany({ where: { id: { in: wfIds } }, select: { id: true, siteProjectId: true } })).map((w) => [w.id, w.siteProjectId]) : [],
    );
    await prisma.$transaction(async (tx) => {
      for (const e of payload.entries) {
        const where = { personType_personId_date: { personType: e.personType, personId: e.personId, date } };
        if (!e.status) {
          const del = await tx.attendanceRecord.deleteMany({ where: { personType: e.personType, personId: e.personId, date } });
          cleared += del.count;
          continue;
        }
        const data = {
          status: e.status,
          projectId: e.projectId ?? payload.projectId ?? (e.personType === 'WORKFORCE' ? wfSites.get(e.personId) : null) ?? null,
          checkIn: e.checkIn || null,
          checkOut: e.checkOut || null,
          notes: e.notes || null,
          markedById: actor.id,
        };
        await tx.attendanceRecord.upsert({
          where,
          update: data,
          create: { personType: e.personType, personId: e.personId, date, ...data },
        });
        saved += 1;
      }
    });
    activity.record({ userId: actor.id, action: 'attendance.marked', entityType: 'attendance', entityId: payload.date, req });
    return { saved, cleared };
  },

  // Per-person monthly counts.
  async summary(query) {
    const range = monthRange(query.month);
    const rl = await rules();
    const records = await prisma.attendanceRecord.findMany({
      where: { date: range },
      select: { personType: true, personId: true, status: true, checkIn: true },
    });
    const people = await listPeople({ type: query.type });
    const agg = new Map();
    for (const r of records) {
      const k = keyOf(r.personType, r.personId);
      const a = agg.get(k) || { present: 0, absent: 0, half_day: 0, leave: 0, late: 0 };
      a[r.status] = (a[r.status] || 0) + 1;
      if (r.checkIn && isLate(r.checkIn, rl)) a.late += 1;
      agg.set(k, a);
    }
    // Include people who are inactive now but have records this month.
    const known = new Set(people.map((p) => p.key));
    const extraRefs = [...agg.keys()].filter((k) => !known.has(k)).map((k) => {
      const [personType, id] = k.split(':');
      return { personType, personId: Number(id) };
    });
    const extra = await resolvePeople(extraRefs);
    const all = [
      ...people,
      ...extraRefs.map((r) => ({ ...r, key: keyOf(r.personType, r.personId), ...(extra.get(keyOf(r.personType, r.personId)) || { name: 'Unknown' }) })),
    ];
    const rows = all.map((p) => {
      const a = agg.get(p.key) || { present: 0, absent: 0, half_day: 0, leave: 0, late: 0 };
      return { ...p, ...a, daysWorked: a.present + a.half_day * 0.5 };
    });
    // Working days in the month (up to today) excluding weekly offs.
    const [y, m] = query.month.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const t = new Date();
    const upto = y === t.getFullYear() && m === t.getMonth() + 1 ? t.getDate() : last;
    let workingDays = 0;
    for (let d = 1; d <= upto; d += 1) if (!rl.weeklyOff.includes(DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()])) workingDays += 1;
    return { month: query.month, rows, workingDays, rules: rl };
  },

  // Self check-in / check-out (web or mobile) when enabled in Settings.
  async mine(actor) {
    const r = await rules();
    const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { staffType: true } });
    const rec = await prisma.attendanceRecord.findUnique({ where: { personType_personId_date: { personType: 'USER', personId: actor.id, date: toDay(todayStr()) } } });
    return { enabled: r.selfCheckin && user?.staffType === 'EMPLOYEE', date: todayStr(), record: rec ? { ...rec, late: !!(rec.checkIn && isLate(rec.checkIn, r)) } : null, rules: r };
  },

  async punch(action, payload, actor, req) {
    const me = await this.mine(actor);
    if (!me.enabled) throw AppError.forbidden('Self check-in is not enabled for you');
    const date = toDay(me.date);
    const where = { personType_personId_date: { personType: 'USER', personId: actor.id, date } };
    const time = nowHHMM();
    if (action === 'in') {
      if (me.record?.checkIn) throw AppError.badRequest(`Already checked in at ${me.record.checkIn}`);
      await prisma.attendanceRecord.upsert({
        where,
        update: { checkIn: time, status: me.record?.status || 'present', projectId: payload.projectId ?? me.record?.projectId ?? null, markedById: actor.id },
        create: { personType: 'USER', personId: actor.id, date, status: 'present', checkIn: time, projectId: payload.projectId ?? null, notes: payload.notes || null, markedById: actor.id },
      });
    } else {
      if (!me.record?.checkIn) throw AppError.badRequest('Check in first');
      if (me.record.checkOut) throw AppError.badRequest(`Already checked out at ${me.record.checkOut}`);
      await prisma.attendanceRecord.update({ where, data: { checkOut: time, ...(payload.notes ? { notes: payload.notes } : {}) } });
    }
    activity.record({ userId: actor.id, action: `attendance.check_${action}`, entityType: 'attendance', entityId: me.date, req });
    return this.mine(actor);
  },

  async person(query) {
    const range = monthRange(query.month);
    return prisma.attendanceRecord.findMany({
      where: { personType: query.personType, personId: query.personId, date: range },
      orderBy: { date: 'asc' },
    });
  },
};

module.exports = attendanceService;
