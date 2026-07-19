'use strict';

const { z } = require('zod');

const updateCompanySchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    logoUrl: z.string().max(500).nullable().optional(),
    phone: z.string().max(30).nullable().optional(),
    email: z.string().email().nullable().optional().or(z.literal('')),
    address: z.string().max(1000).nullable().optional(),
    currency: z.string().min(1).max(10).optional(),
    timezone: z.string().min(1).max(60).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// Generic setting value can be any JSON (scalar, list, or object).
const upsertSettingSchema = z.object({
  value: z.any(),
});

const groupKeyParams = z.object({
  group: z.string().min(1).max(50),
  key: z.string().min(1).max(60),
});

const groupParam = z.object({ group: z.string().min(1).max(50) });

const fieldTypeEnum = z.enum(['text', 'number', 'date', 'select', 'textarea', 'checkbox']);

const createFieldDefSchema = z.object({
  entityType: z.string().min(1).max(50),
  key: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z][a-z0-9_]*$/, 'Key must be lowercase letters, numbers, and underscores'),
  label: z.string().min(1).max(120),
  fieldType: fieldTypeEnum,
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  required: z.boolean().optional(),
  visible: z.boolean().optional(),
  isCustom: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const updateFieldDefSchema = z
  .object({
    label: z.string().min(1).max(120).optional(),
    fieldType: fieldTypeEnum.optional(),
    options: z.array(z.object({ label: z.string(), value: z.string() })).nullable().optional(),
    required: z.boolean().optional(),
    visible: z.boolean().optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const idParam = z.object({ id: z.coerce.number().int().positive() });
const entityTypeQuery = z.object({ entityType: z.string().min(1).max(50) });

module.exports = {
  updateCompanySchema,
  upsertSettingSchema,
  groupKeyParams,
  groupParam,
  createFieldDefSchema,
  updateFieldDefSchema,
  idParam,
  entityTypeQuery,
};
