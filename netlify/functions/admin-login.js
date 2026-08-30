// POST /.netlify/functions/admin-login  { password }
// Verifies the owner password and, on success, sets the session cookie.
// A small fixed delay on failure blunts brute-force / timing attempts.
import { checkPassword, makeToken, sessionCookie, clearCookie, json } from './_lib/auth.js';

export const handler = async (event) => {
  if (event.httpMethod === 'DELETE') {
    return json(200, { ok: true }, { 'Set-Cookie': clearCookie() });
  }
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
    return json(500, { error: 'Server not configured. Set ADMIN_PASSWORD and SESSION_SECRET.' });
  }

  let password = '';
  try { password = (JSON.parse(event.body || '{}').password) || ''; } catch {}

  if (!checkPassword(password)) {
    await new Promise((r) => setTimeout(r, 600));
    return json(401, { error: 'Incorrect password' });
  }

  const token = makeToken();
  return json(200, { ok: true }, { 'Set-Cookie': sessionCookie(token) });
};
