// Shared auth for the owner CRM.
//
// Model: a single owner password (env ADMIN_PASSWORD) is exchanged at /admin
// login for a short-lived HMAC-signed session token, stored in an HttpOnly,
// Secure, SameSite=Strict cookie. Every privileged function calls requireAuth()
// and returns 401 when it fails. No third-party auth service, no database.
//
// Required environment variables (set in the Netlify dashboard, never in the repo):
//   ADMIN_PASSWORD  — the login password the owner types
//   SESSION_SECRET  — a long random string used to sign session tokens
//
import crypto from 'node:crypto';

const COOKIE = 'bsq_admin';
const DEFAULT_TTL = 60 * 60 * 8; // 8 hours

// Constant-time compare of the submitted password against ADMIN_PASSWORD.
export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD || '';
  if (!expected || !input) return false;
  const a = Buffer.from(String(input));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function makeToken(ttlSeconds = DEFAULT_TTL) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET not set');
  const payload = { sub: 'owner', exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  try {
    const secret = process.env.SESSION_SECRET;
    if (!secret || !token) return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(body).digest('base64url');
    const a = Buffer.from(sig), b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getToken(event) {
  const cookie = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const m = cookie.match(new RegExp(COOKIE + '=([^;]+)'));
  return m ? m[1] : null;
}

export function requireAuth(event) {
  return verifyToken(getToken(event));
}

export function sessionCookie(token, maxAge = DEFAULT_TTL) {
  return `${COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearCookie() {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

// Small JSON response helper shared by the CRM functions.
export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
    body: JSON.stringify(body),
  };
}
