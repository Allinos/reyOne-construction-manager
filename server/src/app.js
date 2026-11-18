'use strict';

const path = require('path');
const fs = require('fs');
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
const AppError = require('./core/errors/AppError');
const { mobileEnabled } = require('./core/services/push');

/**
 * Builds the Express app. Async because modules are mounted dynamically from
 * the database (enabled modules only).
 */
async function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.clientOrigin, credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'X-Client'] }));
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  if (!env.isProd) app.use(morgan('dev'));
  app.set('trust proxy', 1);

  // Health check (always available, unversioned + versioned).
  const health = (_req, res) => ok(res, { status: 'ok', uptime: process.uptime() });
  app.get('/health', health);
  app.get(`${env.apiPrefix}/health`, health);

  // Public instance info — lets the mobile app confirm a connection code/QR
  // points at a real reyOne instance (and whether the app is activated) before
  // the user signs in. Exposes nothing beyond name/logo.
  app.get(`${env.apiPrefix}/public/instance`, async (_req, res, next) => {
    try {
      const prisma = require('./config/prisma');
      const company = await prisma.company.findFirst({ select: { name: true, logoUrl: true } });
      ok(res, { app: 'reyone', name: company?.name || 'reyOne', logoUrl: company?.logoUrl || null, mobileEnabled: await mobileEnabled() });
    } catch (err) {
      next(err);
    }
  });

  // The Flutter app identifies itself with "X-Client: mobile". It only works
  // for companies where the Mobile App module is enabled.
  app.use(env.apiPrefix, async (req, _res, next) => {
    if (String(req.get('x-client') || '').toLowerCase() !== 'mobile') return next();
    try {
      if (await mobileEnabled()) return next();
      return next(AppError.forbidden('The mobile app is not activated for this company. Ask your administrator to enable it in Settings → Modules.'));
    } catch (err) {
      return next(err);
    }
  });

  // Mount enabled modules under the API prefix.
  await mountModules(app, env.apiPrefix);

  // Serve a static frontend from server/public (drop a built React app here).
  const publicDir = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    // SPA fallback: non-API GET requests return index.html when present.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith(env.apiPrefix) || req.path === '/health') return next();
      const indexFile = path.join(publicDir, 'index.html');
      if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
      return next();
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
