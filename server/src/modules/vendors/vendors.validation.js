'use strict';

const { z } = require('zod');

const createVendorSchema = z.object({
  name: z.string().min(1).max(150),
  contactPerson: z.string().max(150).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  gstNumber: z.string().max(40).optional(),
  address: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
});

const updateVendorSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    contactPerson: z.string().max(150).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    email: z.string().email().nullable().optional().or(z.literal('')),
    gstNumber: z.string().max(40).nullable().optional(),
    address: z.string().max(1000).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

module.exports = { createVendorSchema, updateVendorSchema, listQuery, idParam };
