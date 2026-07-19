'use strict';

const controller = require('./projects.controller');
const asyncHandler = require('../../core/http/asyncHandler');
const authenticate = require('../../core/middleware/authenticate');
const authorize = require('../../core/middleware/authorize');
const validate = require('../../core/middleware/validate');
const {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuery,
  addPhaseSchema,
  updatePhaseSchema,
  addTaskSchema,
  updateTaskSchema,
  idParam,
  phaseParams,
  taskParams,
} = require('./projects.validation');

function registerRoutes(router) {
  router.use(authenticate);

  // Projects
  router.get('/', authorize('projects.read'), validate({ query: listProjectsQuery }), asyncHandler(controller.list));
  router.get('/:id', authorize('projects.read'), validate({ params: idParam }), asyncHandler(controller.get));
  router.post('/', authorize('projects.create'), validate({ body: createProjectSchema }), asyncHandler(controller.create));
  router.patch(
    '/:id',
    authorize('projects.update'),
    validate({ params: idParam, body: updateProjectSchema }),
    asyncHandler(controller.update),
  );
  router.delete('/:id', authorize('projects.delete'), validate({ params: idParam }), asyncHandler(controller.remove));

  // Phases
  router.post(
    '/:id/phases',
    authorize('projects.update'),
    validate({ params: idParam, body: addPhaseSchema }),
    asyncHandler(controller.addPhase),
  );
  router.patch(
    '/:id/phases/:phaseId',
    authorize('projects.update'),
    validate({ params: phaseParams, body: updatePhaseSchema }),
    asyncHandler(controller.updatePhase),
  );
  router.delete(
    '/:id/phases/:phaseId',
    authorize('projects.update'),
    validate({ params: phaseParams }),
    asyncHandler(controller.removePhase),
  );

  // Tasks
  router.post(
    '/:id/phases/:phaseId/tasks',
    authorize('projects.update'),
    validate({ params: phaseParams, body: addTaskSchema }),
    asyncHandler(controller.addTask),
  );
  router.patch(
    '/:id/phases/:phaseId/tasks/:taskId',
    authorize('projects.update'),
    validate({ params: taskParams, body: updateTaskSchema }),
    asyncHandler(controller.updateTask),
  );
  router.delete(
    '/:id/phases/:phaseId/tasks/:taskId',
    authorize('projects.update'),
    validate({ params: taskParams }),
    asyncHandler(controller.removeTask),
  );
}

module.exports = { registerRoutes };
