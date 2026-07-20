'use strict';

const prisma = require('../../config/prisma');

function swallow(err) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.error('notify failed:', err.message);
  }
}

// Create one in-app notification. Fire-and-forget — never breaks the request.
function notify({ userId, type, title, message, entityType, entityId }) {
  if (!userId) return Promise.resolve();
  return prisma.notification
    .create({
      data: {
        userId,
        type,
        title,
        message: message ?? null,
        entityType: entityType ?? null,
        entityId: entityId != null ? String(entityId) : null,
      },
    })
    .catch(swallow);
}

// Notify many recipients at once (deduped).
function notifyMany(userIds, payload) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (!unique.length) return Promise.resolve();
  return prisma.notification
    .createMany({
      data: unique.map((userId) => ({
        userId,
        type: payload.type,
        title: payload.title,
        message: payload.message ?? null,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId != null ? String(payload.entityId) : null,
      })),
    })
    .catch(swallow);
}

module.exports = { notify, notifyMany };
