const crypto = require('crypto');

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 horas

function getSecret() {
  return process.env.ADMIN_PASSWORD || 'fallback-secret';
}

function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

function createSessionToken() {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${expires}`;
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (sig.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(payload) > Date.now();
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies.admin_session);
}

module.exports = { createSessionToken, verifySessionToken, parseCookies, isAuthenticated, SESSION_TTL_MS };
