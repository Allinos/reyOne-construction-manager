'use strict';

const { z } = require('zod');

const statusEnum = z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']);

const createUserSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().max(30).optional(),
  designation: z.string().max(100).optional(),
  salary: z.coerce.number().nonnegative().optional(),
  roleId: z.coerce.number().int().positive(),
  status: statusEnum.optional(),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    email: z.string().email().optional(),
    phone: z.string().max(30).nullable().optional(),
    designation: z.string().max(100).nullable().optional(),
    salary: z.coerce.number().nonnegative().nullable().optional(),
    roleId: z.coerce.number().int().positive().optional(),
    status: statusEnum.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const listUsersQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  roleId: z.coerce.number().int().positive().optional(),
  status: statusEnum.optional(),
});

const idParam = z.object({ id: z.coerce.number().int().positive() });

module.exports = {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  listUsersQuery,
  idParam,
};
