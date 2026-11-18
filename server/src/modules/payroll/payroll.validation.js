'use strict';

const { z } = require('zod');

const personType = z.enum(['USER', 'WORKFORCE']);
const personId = z.coerce.number().int().positive();
const money = z.coerce.number().nonnegative();
const month = z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM');

module.exports = {
  typeQuery: z.object({ type: personType.optional() }),
  summaryQuery: z.object({ month: month.optional(), type: personType.optional() }),
  personQuery: z.object({ personType, personId }),
  profileSchema: z.object({
    personType, personId,
    payType: z.enum(['monthly', 'daily']),
    rate: money,
    effectiveFrom: z.coerce.date().optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    active: z.boolean().optional(),
  }),
  paymentSchema: z.object({
    personType, personId,
    period: month,
    grossAmount: money,
    advanceDeduction: money.optional(),
    otherDeduction: money.optional(),
    bonus: money.optional(),
    date: z.coerce.date().optional(),
    method: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
    addToExpenses: z.boolean().optional(),
  }),
  advanceSchema: z.object({
    personType, personId,
    amount: z.coerce.number().positive(),
    date: z.coerce.date().optional(),
    method: z.string().max(50).optional(),
    notes: z.string().max(1000).optional(),
    addToExpenses: z.boolean().optional(),
  }),
  paymentsQuery: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    personType: personType.optional(),
    personId: personId.optional(),
    period: month.optional(),
  }),
  advancesQuery: z.object({ personType: personType.optional(), personId: personId.optional() }),
  idParam: z.object({ id: z.coerce.number().int().positive() }),
};
