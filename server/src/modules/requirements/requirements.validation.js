'use strict';

const { z } = require('zod');

const kindEnum = z.enum(['TEXT', 'FORM', 'TABLE']);

// `content` shape depends on `kind` and is driven by the configurable UI, so we
// accept any JSON object here and let the frontend own the structure:
//   TEXT:  { text }
//   FORM:  { fields: [...], rows: [...] }
//   TABLE: { columns: [...], rows: [[...]] }
const contentSchema = z.record(z.any());

const createRequirementSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  kind: kindEnum,
  title: z.string().max(200).optional(),
  content: contentSchema.optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const updateRequirementSchema = z
  .object({
    title: z.string().max(200).nullable().optional(),
    content: contentSchema.optional(),
    sortOrder: z.coerce.number().int().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listQuery = z.object({
  projectId: z.coerce.number().int().positive(),
  kind: kindEnum.optional(),
});

const createPhotoSchema = z.object({
  projectId: z.coerce.number().int().positive(),
  name: z.string().max(255).optional(),
  mimeType: z.string().max(100).optional(),
  category: z.string().max(80).optional(),
  data: z.string().min(1), // base64 data URL
});

const updatePhotoSchema = z.object({
  category: z.string().max(80).nullable().optional(),
});

const photoQuery = z.object({ projectId: z.coerce.number().int().positive() });

const idParam = z.object({ id: z.coerce.number().int().positive() });

module.exports = {
  createRequirementSchema,
  updateRequirementSchema,
  listQuery,
  createPhotoSchema,
  updatePhotoSchema,
  photoQuery,
  idParam,
};
