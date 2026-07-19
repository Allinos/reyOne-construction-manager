'use strict';

const prisma = require('../../config/prisma');

/**
 * Records a mutating action. Fire-and-forget: logging must never break the
 * request, so failures are swallowed (and logged in dev).
 *
 *   record({ userId, action: 'user.created', entityType: 'user', entityId, meta, req })
 */
function record({ userId, action, entityType, entityId, meta, req }) {
  const ip = req?.ip || req?.headers?.['x-forwarded-for'] || null;
  prisma.activityLog
    .create({
      data: {
        userId: userId ?? null,
        action,
        entityType: entityType ?? null,
        entityId: entityId != null ? String(entityId) : null,
        meta: meta ?? undefined,
        ip: ip ? String(ip) : null,
      },
    })
    .catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.error('activityLog failed:', err.message);
      }
    });
}

module.exports = { record };
