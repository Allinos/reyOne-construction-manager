'use strict';

const prisma = require('../../config/prisma');

/**
 * Project-based access control. Users holding `projects.view_all` (or the
 * Owner wildcard) see every project; everyone else only the projects they are
 * assigned to (project, phase or task level).
 */
function hasPerm(actor, key) {
  const perms = actor?.permissions || [];
  return perms.includes('*') || perms.includes(key);
}

function seesAllProjects(actor) {
  return hasPerm(actor, 'projects.view_all');
}

// Returns null when unrestricted, else the array of accessible project ids.
async function accessibleProjectIds(actor) {
  if (!actor || seesAllProjects(actor)) return null;
  const [p, ph, t] = await Promise.all([
    prisma.projectAssignee.findMany({ where: { userId: actor.id }, select: { projectId: true } }),
    prisma.phaseAssignee.findMany({ where: { userId: actor.id }, select: { phase: { select: { projectId: true } } } }),
    prisma.taskAssignee.findMany({ where: { userId: actor.id }, select: { task: { select: { phase: { select: { projectId: true } } } } } }),
  ]);
  return [...new Set([
    ...p.map((r) => r.projectId),
    ...ph.map((r) => r.phase.projectId),
    ...t.map((r) => r.task.phase.projectId),
  ])];
}

// Adds a projectId restriction to a Prisma `where` (field defaults to projectId).
async function scopeWhere(actor, where = {}, field = 'projectId') {
  const ids = await accessibleProjectIds(actor);
  if (ids === null) return where;
  return { ...where, [field]: { in: ids } };
}

async function assertProjectAccess(actor, projectId) {
  const ids = await accessibleProjectIds(actor);
  if (ids !== null && !ids.includes(Number(projectId))) {
    const AppError = require('../errors/AppError');
    throw AppError.forbidden('You are not assigned to this project');
  }
}

// Active users whose role grants `key` (or the Owner wildcard).
async function usersWithPermission(key) {
  const rows = await prisma.user.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      role: { permissions: { some: { permission: { key: { in: [key, '*'] } } } } },
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

module.exports = { usersWithPermission, hasPerm, seesAllProjects, accessibleProjectIds, scopeWhere, assertProjectAccess };
