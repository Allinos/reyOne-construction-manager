'use strict';

const prisma = require('../../config/prisma');

const requirementsRepository = {
  // --- Requirements (TEXT | FORM | TABLE) ---
  listRequirements(where) {
    return prisma.projectRequirement.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
  },
  findRequirement(id) {
    return prisma.projectRequirement.findUnique({ where: { id } });
  },
  createRequirement(data) {
    return prisma.projectRequirement.create({ data });
  },
  updateRequirement(id, data) {
    return prisma.projectRequirement.update({ where: { id }, data });
  },
  deleteRequirement(id) {
    return prisma.projectRequirement.delete({ where: { id } });
  },

  // --- Photos ---
  listPhotos(projectId) {
    return prisma.projectPhoto.findMany({
      where: { projectId },
      orderBy: { id: 'desc' },
    });
  },
  findPhoto(id) {
    return prisma.projectPhoto.findUnique({ where: { id } });
  },
  createPhoto(data) {
    return prisma.projectPhoto.create({ data });
  },
  deletePhoto(id) {
    return prisma.projectPhoto.delete({ where: { id } });
  },
};

module.exports = requirementsRepository;
