'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const prisma = require('../../config/prisma');

const MODULES_DIR = path.join(__dirname, '..', '..', 'modules');

/**
 * Discovers every module manifest (src/modules/<key>/<key>.module.js).
 * A manifest describes a module and knows how to register its own routes.
 */
function loadManifests() {
  if (!fs.existsSync(MODULES_DIR)) return [];
  const manifests = [];
  for (const dir of fs.readdirSync(MODULES_DIR)) {
    const manifestPath = path.join(MODULES_DIR, dir, `${dir}.module.js`);
    if (fs.existsSync(manifestPath)) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const manifest = require(manifestPath);
      if (!manifest.key) throw new Error(`Module manifest ${manifestPath} is missing "key"`);
      manifests.push(manifest);
    }
  }
  return manifests.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

/**
 * Mounts routes for every module that is either core or enabled in the DB.
 * Disabled modules are simply never mounted, so their API returns 404.
 */
async function mountModules(app, apiPrefix) {
  const manifests = loadManifests();

  let dbModules = [];
  try {
    dbModules = await prisma.module.findMany();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Could not read modules table (run migrations/seed):', err.message);
  }
  const enabledByKey = new Map(dbModules.map((m) => [m.key, m.enabled]));

  const mounted = [];
  for (const manifest of manifests) {
    const enabled = manifest.isCore || enabledByKey.get(manifest.key) === true;
    if (!enabled) continue;

    const router = express.Router();
    manifest.registerRoutes(router);
    const basePath = manifest.basePath || `/${manifest.key}`;
    app.use(`${apiPrefix}${basePath}`, router);
    mounted.push(manifest.key);
  }

  // eslint-disable-next-line no-console
  console.log(`Mounted modules: ${mounted.join(', ') || '(none)'}`);
  return mounted;
}

module.exports = { loadManifests, mountModules, MODULES_DIR };
