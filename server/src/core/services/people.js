'use strict';

const prisma = require('../../config/prisma');

/**
 * A "person" is a system user (employee) or a workforce member (labour /
 * contractor). Identified by { personType: 'USER' | 'WORKFORCE', personId }.
 */
const TYPES = ['USER', 'WORKFORCE'];

const keyOf = (type, id) => `${type}:${id}`;

// All active people, optionally one type. Light rows for pickers/sheets.
async function listPeople({ type } = {}) {
  const [users, workforce] = await Promise.all([
    !type || type === 'USER'
      ? prisma.user.findMany({
          where: { deletedAt: null, status: 'ACTIVE' },
          select: { id: true, name: true, designation: true, phone: true, role: { select: { name: true } } },
          orderBy: { name: 'asc' },
        })
      : [],
    !type || type === 'WORKFORCE'
      ? prisma.workforce.findMany({
          where: { deletedAt: null, status: 'ACTIVE' },
          select: { id: true, name: true, category: true, phone: true },
          orderBy: { name: 'asc' },
        })
      : [],
  ]);
  return [
    ...users.map((u) => ({
      personType: 'USER', personId: u.id, key: keyOf('USER', u.id), name: u.name,
      group: 'Employee', detail: u.designation || u.role?.name || '', phone: u.phone,
    })),
    ...workforce.map((w) => ({
      personType: 'WORKFORCE', personId: w.id, key: keyOf('WORKFORCE', w.id), name: w.name,
      group: 'Workforce', detail: w.category || '', phone: w.phone,
    })),
  ];
}

// Map of "TYPE:id" -> { name, detail } for a list of refs (includes inactive).
async function resolvePeople(refs) {
  const userIds = [...new Set(refs.filter((r) => r.personType === 'USER').map((r) => r.personId))];
  const wfIds = [...new Set(refs.filter((r) => r.personType === 'WORKFORCE').map((r) => r.personId))];
  const [users, wf] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, designation: true } }) : [],
    wfIds.length ? prisma.workforce.findMany({ where: { id: { in: wfIds } }, select: { id: true, name: true, category: true } }) : [],
  ]);
  const map = new Map();
  for (const u of users) map.set(keyOf('USER', u.id), { name: u.name, detail: u.designation || '', group: 'Employee' });
  for (const w of wf) map.set(keyOf('WORKFORCE', w.id), { name: w.name, detail: w.category || '', group: 'Workforce' });
  return map;
}

async function userNames(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, name: true } });
  return new Map(rows.map((r) => [r.id, r.name]));
}

async function projectNames(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await prisma.project.findMany({ where: { id: { in: unique } }, select: { id: true, name: true, referenceNumber: true } });
  return new Map(rows.map((r) => [r.id, r]));
}

module.exports = { TYPES, keyOf, listPeople, resolvePeople, userNames, projectNames };
