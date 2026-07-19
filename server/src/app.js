'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const { mountModules } = require('./core/modules/registry');
const { ok } = require('./core/http/response');
const notFound = require('./core/middleware/notFound');
const errorHandler = require('./core/middleware/errorHandler');

/**
 * Builds the Express app. Async because modules are mounted dynamically from
 * the database (enabled modules only).
 */
async function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));
  app.set('trust proxy', 1);

  // Health check (always available, unversioned + versioned).
  const health = (_req, res) => ok(res, { status: 'ok', uptime: process.uptime() });
  app.get('/health', health);
  app.get(`${env.apiPrefix}/health`, health);

  // Mount enabled modules under the API prefix.
  await mountModules(app, env.apiPrefix);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
