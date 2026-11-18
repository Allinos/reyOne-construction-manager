'use strict';

const { z } = require('zod');

const id = z.coerce.number().int().positive();
const qty = z.coerce.number().positive();
const optProject = id.optional().nullable();

module.exports = {
  idParam: z.object({ id }),
  itemsQuery: z.object({ search: z.string().trim().optional(), category: z.string().optional() }),
  itemSchema: z.object({ name: z.string().min(1).max(150), unit: z.string().max(20).optional(), category: z.string().max(80).optional().nullable(), reorderLevel: z.coerce.number().nonnegative().optional(), notes: z.string().max(1000).optional().nullable() }),
  itemUpdateSchema: z.object({ name: z.string().min(1).max(150).optional(), unit: z.string().max(20).optional(), category: z.string().max(80).optional().nullable(), reorderLevel: z.coerce.number().nonnegative().optional(), notes: z.string().max(1000).optional().nullable() }).refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' }),
  stockQuery: z.object({ projectId: id.optional(), all: z.enum(['true', 'false']).optional() }),
  movementsQuery: z.object({ page: id.optional(), limit: id.optional(), materialId: id.optional(), vendorId: id.optional(), type: z.string().optional(), projectId: z.union([z.literal('store'), z.string().regex(/^\d+$/)]).optional() }),
  purchaseSchema: z.object({ materialId: id, quantity: qty, rate: z.coerce.number().nonnegative().optional(), vendorId: id.optional().nullable(), projectId: optProject, date: z.coerce.date().optional(), notes: z.string().max(1000).optional(), method: z.string().max(50).optional(), paymentStatus: z.enum(['PAID', 'CREDIT']).optional(), addToExpenses: z.boolean().optional() }),
  transferSchema: z.object({ materialId: id, quantity: qty, fromProjectId: optProject, toProjectId: optProject, date: z.coerce.date().optional(), notes: z.string().max(1000).optional() }),
  consumeSchema: z.object({ materialId: id, quantity: qty, projectId: id, date: z.coerce.date().optional(), notes: z.string().max(1000).optional() }),
  adjustSchema: z.object({ materialId: id, quantity: z.coerce.number().refine((n) => n !== 0, 'Quantity cannot be zero'), projectId: optProject, reason: z.enum(['adjust', 'return']).optional(), notes: z.string().max(1000).optional() }),
  requestsQuery: z.object({ status: z.string().optional(), projectId: id.optional() }),
  requestSchema: z.object({ projectId: id, items: z.array(z.object({ materialId: id, quantity: qty })).min(1).max(100), priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(), neededBy: z.coerce.date().optional().nullable(), notes: z.string().max(2000).optional() }),
  decideSchema: z.object({ decision: z.enum(['approve', 'reject']), note: z.string().max(2000).optional(), items: z.array(z.object({ materialId: id, approvedQty: z.coerce.number().nonnegative() })).optional() }),
  fulfillSchema: z.object({ fromProjectId: optProject, items: z.array(z.object({ materialId: id, quantity: z.coerce.number().nonnegative() })).optional() }),
  consumptionQuery: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional(), projectId: id.optional() }),
};
