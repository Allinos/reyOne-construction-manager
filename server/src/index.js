'use strict';

const createApp = require('./app');
const env = require('./config/env');
const prisma = require('./config/prisma');

async function start() {
  const app = await createApp();

  const server = app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`reyOne API listening on http://localhost:${env.port}${env.apiPrefix}`);
  });

  const shutdown = async (signal) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
