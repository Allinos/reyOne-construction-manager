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
  startDate: z.coerce.date().optional(),
  deadline: z.coerce.date().optional(),
  sortOrder: z.coerce.number().int().optional(),
  assigneeIds,
  tasks: z.array(taskInput).optional(),
});

const progressMode = z.enum(['auto', 'manual']).optional();
const progress = z.coerce.number().int().min(0).max(100).optional();

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
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  projectAmount: z.coerce.number().nonnegative().optional(),
  advanceAmount: z.coerce.number().nonnegative().optional(),
  progress,
  progressMode,
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
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    projectAmount: z.coerce.number().nonnegative().optional(),
    advanceAmount: z.coerce.number().nonnegative().optional(),
    progress,
    progressMode,
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
    startDate: z.coerce.date().nullable().optional(),
    deadline: z.coerce.date().nullable().optional(),
    sortOrder: z.coerce.number().int().optional(),
    assigneeIds,
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'No fields to update' });

// --- approvals / requests ---
const createApprovalSchema = z.object({
  phaseId: z.coerce.number().int().positive().optional(),
  type: z.enum(['phase_completion', 'budget', 'material', 'general']).optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  amount: z.coerce.number().nonnegative().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const decideApprovalSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(2000).optional(),
});

const approvalParams = z.object({
  id: z.coerce.number().int().positive(),
  approvalId: z.coerce.number().int().positive(),
});

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
  createApprovalSchema,
  decideApprovalSchema,
  approvalParams,
  idParam,
  phaseParams,
  taskParams,
};
