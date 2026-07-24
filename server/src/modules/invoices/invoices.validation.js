'use strict';

const { z } = require('zod');

const itemSchema = z.object({
  description: z.string().min(1).max(300),
  hsnCode: z.string().max(20).optional(),
  quantity: z.coerce.number().nonnegative(),
  unitPrice: z.coerce.number().nonnegative(),
  gstRate: z.coerce.number().min(0).max(100).optional(),
});

const baseDoc = {
  projectId: z.coerce.number().int().positive().optional(),
  clientName: z.string().min(1).max(150),
  clientPhone: z.string().max(30).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientAddress: z.string().max(1000).optional(),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  items: z.array(itemSchema).min(1, 'At least one item is required'),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  status: z.string().max(40).optional(),
  notes: z.string().max(2000).optional(),
  terms: z.string().max(2000).optional(),
};

const createDocumentSchema = z.object({
  type: z.enum(['QUOTATION', 'INVOICE']),
  template: z.enum(['standard', 'gst']).optional(),
  number: z.string().max(50).optional(),
  ...baseDoc,
});

const updateDocumentSchema = z
  .object({
    template: z.enum(['standard', 'gst']).optional(),
    projectId: z.coerce.number().int().positive().nullable().optional(),
    clientName: z.string().min(1).max(150).optional(),
    clientPhone: z.string().max(30).nullable().optional(),
    clientEmail: z.string().email().nullable().optional().or(z.literal('')),
    clientAddress: z.string().max(1000).nullable().optional(),
    issueDate: z.coerce.date().optional(),
    dueDate: z.coerce.date().nullable().optional(),
    items: z.array(itemSchema).min(1).optional(),
    taxRate: z.coerce.number().min(0).max(100).optional(),
    status: z.string().max(40).optional(),
    notes: z.string().max(2000).nullable().optional(),
    terms: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listQuery = z.object({
  type: z.enum(['QUOTATION', 'INVOICE']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

const typeQuery = z.object({ type: z.enum(['QUOTATION', 'INVOICE']) });
const idParam = z.object({ id: z.coerce.number().int().positive() });
// Config is a free-form object of company/billing fields.
const configSchema = z.object({ value: z.record(z.any()) });

module.exports = {
  createDocumentSchema,
  updateDocumentSchema,
  listQuery,
  typeQuery,
  idParam,
  configSchema,
};
