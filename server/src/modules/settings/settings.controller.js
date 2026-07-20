'use strict';

const { spawn } = require('child_process');
const service = require('./settings.service');
const { ok, created } = require('../../core/http/response');

const settingsController = {
  // Streams a full mysqldump of the deployment's database as a .sql download.
  // Requires the `mysqldump` binary to be installed on the server.
  backup(req, res) {
    let url;
    try {
      url = new URL(process.env.DATABASE_URL);
    } catch {
      return res.status(500).json({ success: false, error: { message: 'DATABASE_URL is not configured' } });
    }
    const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
    const args = [
      '-h', url.hostname,
      '-P', url.port || '3306',
      '-u', decodeURIComponent(url.username),
      '--single-transaction',
      '--no-tablespaces',
      database,
    ];
    const child = spawn('mysqldump', args, {
      env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
    });

    const filename = `backup-${database}-${new Date().toISOString().slice(0, 10)}.sql`;
    res.setHeader('Content-Type', 'application/sql');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    let stderr = '';
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.stdout.pipe(res);
    child.on('error', (e) => {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: { message: `mysqldump unavailable: ${e.message}` } });
      } else {
        res.end();
      }
    });
    child.on('close', (code) => {
      if (code !== 0) {
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: { message: `Backup failed: ${stderr.trim()}` } });
        } else {
          res.end();
        }
      }
    });
    return undefined;
  },

  // Company
  async getCompany(req, res) {
    return ok(res, await service.getCompany());
  },
  async updateCompany(req, res) {
    return ok(res, await service.updateCompany(req.body, req.user, req));
  },

  // Generic settings
  async list(req, res) {
    return ok(res, await service.list());
  },
  async getGroup(req, res) {
    return ok(res, await service.getGroup(req.params.group));
  },
  async upsert(req, res) {
    return ok(res, await service.upsert(req.params.group, req.params.key, req.body.value, req.user, req));
  },

  // Field definitions
  async listFieldDefs(req, res) {
    return ok(res, await service.listFieldDefs(req.query.entityType));
  },
  async createFieldDef(req, res) {
    return created(res, await service.createFieldDef(req.body, req.user, req));
  },
  async updateFieldDef(req, res) {
    return ok(res, await service.updateFieldDef(req.params.id, req.body, req.user, req));
  },
  async deleteFieldDef(req, res) {
    return ok(res, await service.deleteFieldDef(req.params.id, req.user, req));
  },
};

module.exports = settingsController;
