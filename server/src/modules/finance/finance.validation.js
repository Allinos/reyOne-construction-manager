'use strict';

const { z } = require('zod');

const money = z.coerce.number().positive();

const createPaymentSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  phaseId: z.coerce.number().int().positive().optional(),
  amount: money,
  date: z.coerce.date(),
  method: z.string().min(1).max(50),
  account: z.string().min(1).max(50),
  notes: z.string().max(1000).optional(),
});

const updatePaymentSchema = z
  .object({
    phaseId: z.coerce.number().int().positive().nullable().optional(),
    amount: money.optional(),
    date: z.coerce.date().optional(),
    method: z.string().min(1).max(50).optional(),
    account: z.string().min(1).max(50).optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listPaymentsQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  projectId: z.coerce.number().int().positive().optional(),
  account: z.string().max(50).optional(),
  method: z.string().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const paymentStatusEnum = z.enum(['PAID', 'PARTIAL', 'CREDIT']);

const createExpenseSchema = z
  .object({
    scope: z.enum(['PROJECT', 'COMPANY']),
    projectId: z.coerce.number().int().positive().optional(),
    vendorId: z.coerce.number().int().positive().optional(),
    workforceId: z.coerce.number().int().positive().optional(),
    category: z.string().min(1).max(100),
    amount: money,
    date: z.coerce.date(),
    method: z.string().min(1).max(50).optional(),
    account: z.string().min(1).max(50).optional(),
    paymentStatus: paymentStatusEnum.optional(),
    amountPaid: z.coerce.number().nonnegative().optional(),
    expenseBy: z.string().max(100).optional(),
    paidTo: z.string().max(150).optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((d) => d.scope !== 'PROJECT' || d.projectId != null, {
    message: 'projectId is required for a project expense',
    path: ['projectId'],
  });

const updateExpenseSchema = z
  .object({
    projectId: z.coerce.number().int().positive().nullable().optional(),
    vendorId: z.coerce.number().int().positive().nullable().optional(),
    workforceId: z.coerce.number().int().positive().nullable().optional(),
    category: z.string().min(1).max(100).optional(),
    amount: money.optional(),
    date: z.coerce.date().optional(),
    method: z.string().min(1).max(50).optional(),
    account: z.string().min(1).max(50).optional(),
    paymentStatus: paymentStatusEnum.optional(),
    amountPaid: z.coerce.number().nonnegative().optional(),
    expenseBy: z.string().max(100).nullable().optional(),
    paidTo: z.string().max(150).nullable().optional(),
    notes: z.string().max(1000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listExpensesQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  scope: z.enum(['PROJECT', 'COMPANY']).optional(),
  projectId: z.coerce.number().int().positive().optional(),
  category: z.string().max(100).optional(),
  account: z.string().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const projectIdParam = z.object({ projectId: z.coerce.number().int().positive() });
const overviewQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

module.exports = {
  createPaymentSchema,
  updatePaymentSchema,
  listPaymentsQuery,
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesQuery,
  idParam,
  projectIdParam,
  overviewQuery,
};
