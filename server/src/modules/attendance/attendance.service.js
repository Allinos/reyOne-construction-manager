'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../../core/errors/AppError');
const activity = require('../../core/services/activityLog');
const { listPeople, resolvePeople, keyOf, projectNames } = require('../../core/services/people');
const { assertProjectAccess } = require('../../core/services/access');

const STATUSES = ['present', 'absent', 'half_day', 'leave'];

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
    const [people, records] = await Promise.all([
      listPeople({ type: query.type }),
      prisma.attendanceRecord.findMany({ where: { date } }),
    ]);
    const byKey = new Map(records.map((r) => [keyOf(r.personType, r.personId), r]));
    const projects = await projectNames(records.map((r) => r.projectId));
    let rows = people.map((p) => {
      const r = byKey.get(p.key);
      return {
        ...p,
        status: r?.status || '',
        checkIn: r?.checkIn || '',
        checkOut: r?.checkOut || '',
        notes: r?.notes || '',
        projectId: r?.projectId || null,
        projectName: r?.projectId ? projects.get(r.projectId)?.name || null : null,
      };
    });
    if (query.projectId) rows = rows.filter((r) => !r.status || r.projectId === Number(query.projectId));
    const counts = STATUSES.reduce((acc, s) => ({ ...acc, [s]: rows.filter((r) => r.status === s).length }), {});
    counts.unmarked = rows.filter((r) => !r.status).length;
    return { date: query.date, rows, counts };
  },

  // Bulk upsert a day's sheet. An empty status clears the record.
  async saveDay(payload, actor, req) {
    const date = toDay(payload.date);
    if (payload.projectId) await assertProjectAccess(actor, payload.projectId);
    let saved = 0;
    let cleared = 0;
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
          projectId: e.projectId ?? payload.projectId ?? null,
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
    const records = await prisma.attendanceRecord.findMany({
      where: { date: range },
      select: { personType: true, personId: true, status: true },
    });
    const people = await listPeople({ type: query.type });
    const agg = new Map();
    for (const r of records) {
      const k = keyOf(r.personType, r.personId);
      const a = agg.get(k) || { present: 0, absent: 0, half_day: 0, leave: 0 };
      a[r.status] = (a[r.status] || 0) + 1;
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
      const a = agg.get(p.key) || { present: 0, absent: 0, half_day: 0, leave: 0 };
      return { ...p, ...a, daysWorked: a.present + a.half_day * 0.5 };
    });
    return { month: query.month, rows };
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
