'use strict';

const { z } = require('zod');

const dataSchema = z.record(z.any());

const createDocumentSchema = z.object({
  templateKey: z.string().min(1).max(60),
  title: z.string().max(200).optional(),
  reference: z.string().max(60).optional(),
  projectId: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
  data: dataSchema.optional(),
  status: z.enum(['draft', 'final']).optional(),
});

const updateDocumentSchema = z
  .object({
    title: z.string().max(200).optional(),
    reference: z.string().max(60).nullable().optional(),
    projectId: z.coerce.number().int().positive().nullable().optional(),
    clientId: z.coerce.number().int().positive().nullable().optional(),
    data: dataSchema.optional(),
    status: z.enum(['draft', 'final']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const previewSchema = z.object({
  templateKey: z.string().min(1).max(60),
  data: dataSchema.optional(),
});

const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  templateKey: z.string().max(60).optional(),
  category: z.string().max(40).optional(),
  projectId: z.coerce.number().int().positive().optional(),
  clientId: z.coerce.number().int().positive().optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });
const keyParam = z.object({ key: z.string().min(1).max(60) });

module.exports = {
  createDocumentSchema,
  updateDocumentSchema,
  previewSchema,
  listQuery,
  idParam,
  keyParam,
};
