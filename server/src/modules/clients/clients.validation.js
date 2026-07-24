'use strict';

const { z } = require('zod');

const updateClientSchema = z
  .object({
    contactPerson: z.string().max(150).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    email: z.string().email().nullable().optional().or(z.literal('')),
    address: z.string().max(1000).nullable().optional(),
    gstNumber: z.string().max(40).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

module.exports = { updateClientSchema, listQuery, idParam };
