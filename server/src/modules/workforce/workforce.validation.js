'use strict';

const { z } = require('zod');

const statusEnum = z.enum(['ACTIVE', 'INACTIVE']);

const createWorkforceSchema = z.object({
  name: z.string().min(1).max(150),
  category: z.string().min(1).max(80),
  phone: z.string().max(30).optional(),
  address: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
  status: statusEnum.optional(),
});

const updateWorkforceSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    category: z.string().min(1).max(80).optional(),
    phone: z.string().max(30).nullable().optional(),
    address: z.string().max(1000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    status: statusEnum.optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  category: z.string().max(80).optional(),
  status: statusEnum.optional(),
  sortBy: z.enum(['name', 'category', 'status', 'createdAt']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

module.exports = { createWorkforceSchema, updateWorkforceSchema, listQuery, idParam };
