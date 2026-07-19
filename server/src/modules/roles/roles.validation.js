'use strict';

const { z } = require('zod');

const keyRegex = /^[a-z][a-z0-9_]*$/;

const createRoleSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(50)
    .regex(keyRegex, 'Key must be lowercase letters, numbers, and underscores')
    .optional(), // derived from name when omitted
  name: z.string().min(2).max(100),
  description: z.string().max(255).optional(),
  permissionKeys: z.array(z.string()).default([]),
});

const updateRoleSchema = z
  .object({
    name: z.string().min(2).max(100).optional(),
    description: z.string().max(255).nullable().optional(),
    permissionKeys: z.array(z.string()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const idParam = z.object({ id: z.coerce.number().int().positive() });

module.exports = { createRoleSchema, updateRoleSchema, idParam };
