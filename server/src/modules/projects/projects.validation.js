'use strict';

const { z } = require('zod');

const assigneeIds = z.array(z.coerce.number().int().positive()).optional();

const taskInput = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.string().max(40).optional(),
  deadline: z.coerce.date().optional(),
  sortOrder: z.coerce.number().int().optional(),
  assigneeIds,
});

const phaseInput = z.object({
  name: z.string().min(1).max(120),
  status: z.string().max(40).optional(),
  deadline: z.coerce.date().optional(),
  sortOrder: z.coerce.number().int().optional(),
  assigneeIds,
  tasks: z.array(taskInput).optional(),
});

const createProjectSchema = z.object({
  referenceNumber: z.string().min(1).max(50).optional(), // auto-generated when omitted
  name: z.string().min(1).max(200),
  clientName: z.string().min(1).max(150),
  clientPhone: z.string().max(30).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
  clientAddress: z.string().max(1000).optional(),
  category: z.string().max(100).optional(),
  status: z.string().max(40).optional(),
  agreementDate: z.coerce.date().optional(),
  projectAmount: z.coerce.number().nonnegative().optional(),
  advanceAmount: z.coerce.number().nonnegative().optional(),
  customFields: z.record(z.any()).optional(),
  phases: z.array(phaseInput).optional(), // omitted => instantiated from template
});

const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    clientName: z.string().min(1).max(150).optional(),
    clientPhone: z.string().max(30).nullable().optional(),
    clientEmail: z.string().email().nullable().optional().or(z.literal('')),
    clientAddress: z.string().max(1000).nullable().optional(),
    category: z.string().max(100).nullable().optional(),
    status: z.string().max(40).optional(),
    agreementDate: z.coerce.date().nullable().optional(),
    projectAmount: z.coerce.number().nonnegative().optional(),
    advanceAmount: z.coerce.number().nonnegative().optional(),
    customFields: z.record(z.any()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const listProjectsQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().trim().optional(),
  category: z.string().max(100).optional(),
  status: z.string().max(40).optional(),
  mine: z.enum(['true', 'false']).optional(),
});

const assignEmployeesSchema = z.object({
  userIds: z.array(z.coerce.number().int().positive()),
});

const addPhaseSchema = phaseInput;
const updatePhaseSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    status: z.string().max(40).optional(),
    deadline: z.coerce.date().nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    assigneeIds,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const addTaskSchema = taskInput;
const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).nullable().optional(),
    status: z.string().max(40).optional(),
    deadline: z.coerce.date().nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    assigneeIds,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

const idParam = z.object({ id: z.coerce.number().int().positive() });
const phaseParams = z.object({
  id: z.coerce.number().int().positive(),
  phaseId: z.coerce.number().int().positive(),
});
const taskParams = z.object({
  id: z.coerce.number().int().positive(),
  phaseId: z.coerce.number().int().positive(),
  taskId: z.coerce.number().int().positive(),
});

module.exports = {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuery,
  assignEmployeesSchema,
  addPhaseSchema,
  updatePhaseSchema,
  addTaskSchema,
  updateTaskSchema,
  idParam,
  phaseParams,
  taskParams,
};
