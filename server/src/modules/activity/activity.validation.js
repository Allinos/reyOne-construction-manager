'use strict';

const { z } = require('zod');

const listActivityQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  userId: z.coerce.number().int().positive().optional(),
  action: z.string().max(100).optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = { listActivityQuery };
