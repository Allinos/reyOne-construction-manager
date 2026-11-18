'use strict';

/**
 * Firebase Cloud Messaging (HTTP v1) push sender. Optional: configure with
 *   FCM_SERVICE_ACCOUNT=/path/to/service-account.json   (or)
 *   FCM_SERVICE_ACCOUNT_JSON='{"project_id":...}'
 * Without credentials, or while the Mobile App module is disabled, sending is
 * a silent no-op. Never throws into the caller.
 */
const fs = require('fs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');

let account;
let cachedToken = null;

function loadAccount() {
  if (account !== undefined) return account;
  try {
    if (process.env.FCM_SERVICE_ACCOUNT_JSON) account = JSON.parse(process.env.FCM_SERVICE_ACCOUNT_JSON);
    else if (process.env.FCM_SERVICE_ACCOUNT) account = JSON.parse(fs.readFileSync(process.env.FCM_SERVICE_ACCOUNT, 'utf8'));
    else account = null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('FCM credentials could not be read:', err.message);
    account = null;
  }
  return account;
}

async function accessToken() {
  if (cachedToken && cachedToken.exp > Date.now() + 60000) return cachedToken.value;
  const acc = loadAccount();
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: acc.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    acc.private_key,
    { algorithm: 'RS256' },
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`FCM auth failed (${res.status})`);
  const json = await res.json();
  cachedToken = { value: json.access_token, exp: Date.now() + json.expires_in * 1000 };
  return cachedToken.value;
}

let mobileEnabledCache = { at: 0, value: false };
async function mobileEnabled() {
  if (Date.now() - mobileEnabledCache.at < 30000) return mobileEnabledCache.value;
  const m = await prisma.module.findUnique({ where: { key: 'mobile_app' } });
  mobileEnabledCache = { at: Date.now(), value: Boolean(m?.enabled) };
  return mobileEnabledCache.value;
}

// Called when modules are toggled so the gate reflects changes immediately.
function invalidateModuleCache() {
  mobileEnabledCache = { at: 0, value: false };
}

function isConfigured() {
  return Boolean(loadAccount());
}

// data values must be strings for FCM.
async function sendToUsers(userIds, { title, body, data = {} }) {
  try {
    if (!isConfigured() || !(await mobileEnabled())) return 0;
    const tokens = await prisma.deviceToken.findMany({ where: { userId: { in: [...new Set(userIds)] } } });
    if (!tokens.length) return 0;
    const bearer = await accessToken();
    const url = `https://fcm.googleapis.com/v1/projects/${loadAccount().project_id}/messages:send`;
    const strData = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]));
    let sent = 0;
    await Promise.all(tokens.map(async (t) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
        body: JSON.stringify({ message: { token: t.token, notification: { title, body: body || '' }, data: strData, android: { priority: 'high' } } }),
      });
      if (res.ok) sent += 1;
      else if (res.status === 404 || res.status === 400) await prisma.deviceToken.delete({ where: { id: t.id } }).catch(() => {});
    }));
    return sent;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('push failed:', err.message); // eslint-disable-line no-console
    return 0;
  }
}

module.exports = { sendToUsers, isConfigured, mobileEnabled, invalidateModuleCache };
