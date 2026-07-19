'use strict';

const { PrismaClient } = require('@prisma/client');

// Single shared Prisma client for the whole process.
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
