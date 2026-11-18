'use strict';

const { z } = require('zod');

const personType = z.enum(['USER', 'WORKFORCE']);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM');

module.exports = {
  peopleQuery: z.object({ type: personType.optional() }),
  dayQuery: z.object({ date: day, type: personType.optional(), projectId: z.coerce.number().int().positive().optional() }),
  saveDaySchema: z.object({
    date: day,
    projectId: z.coerce.number().int().positive().optional(),
    entries: z.array(z.object({
      personType,
      personId: z.coerce.number().int().positive(),
      status: z.enum(['present', 'absent', 'half_day', 'leave', '']),
      projectId: z.coerce.number().int().positive().nullable().optional(),
      checkIn: z.string().max(5).optional().nullable(),
      checkOut: z.string().max(5).optional().nullable(),
      notes: z.string().max(255).optional().nullable(),
    })).max(1000),
  }),
  summaryQuery: z.object({ month, type: personType.optional() }),
  personQuery: z.object({ month, personType, personId: z.coerce.number().int().positive() }),
};
