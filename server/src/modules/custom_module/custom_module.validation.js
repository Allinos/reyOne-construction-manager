'use strict';

const { z } = require('zod');

// A record's values are keyed by field id; the schema is user-defined, so we
// accept any JSON object and let the configured fields drive the UI.
const valuesSchema = z.record(z.any());

const createRecordSchema = z.object({ values: valuesSchema });
const updateRecordSchema = z.object({ values: valuesSchema });

const listQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

// Field definition for the form builder.
const fieldSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  type: z.enum(['text', 'number', 'date', 'dropdown', 'textarea', 'checkbox']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(), // for dropdown
});

const configSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  fields: z.array(fieldSchema),
  listFields: z.array(z.string()).optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

module.exports = { createRecordSchema, updateRecordSchema, listQuery, configSchema, idParam };
