'use strict';

const prisma = require('../../config/prisma');
const AppError = require('../errors/AppError');

async function setting(group, key, fallback) {
  const row = await prisma.setting.findUnique({ where: { group_key: { group, key } } }).catch(() => null);
  return row && row.value !== null && row.value !== undefined ? row.value : fallback;
}

// Company password policy (Settings → Security).
async function assertPasswordPolicy(password) {
  const min = Math.max(8, Number(await setting('security', 'password_min_length', 8)) || 8);
  if (!password || password.length < min) throw AppError.badRequest(`Password must be at least ${min} characters`);
  if (await setting('security', 'password_require_number', false)) {
    if (!/\d/.test(password) || !/[A-Za-z]/.test(password)) throw AppError.badRequest('Password must contain letters and numbers');
  }
}

module.exports = { setting, assertPasswordPolicy };
