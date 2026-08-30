// AUTHENTICATED — the CRM's email-list management.
//   GET    /.netlify/functions/admin-subscribers            -> { subscribers, counts }
//   POST   /.netlify/functions/admin-subscribers { email }  -> add manually
//   DELETE /.netlify/functions/admin-subscribers { email }  -> remove entirely
import { requireAuth, json } from './_lib/auth.js';
import { getJSON, updateArray } from './_lib/store.js';
import { isEmail } from './_lib/email.js';

export const handler = async (event) => {
  if (!requireAuth(event)) return json(401, { error: 'Not authorized' });

  if (event.httpMethod === 'GET') {
    const subs = (await getJSON('subscribers', [])) || [];
    const active = subs.filter((s) => s.status === 'subscribed').length;
    return json(200, { subscribers: subs, counts: { total: subs.length, active, unsubscribed: subs.length - active } });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!isEmail(email)) return json(400, { error: 'Invalid email' });

  if (event.httpMethod === 'POST') {
    const next = await updateArray('subscribers', (list) => {
      const i = list.findIndex((s) => s.email === email);
      const now = new Date().toISOString();
      if (i >= 0) { list[i] = { ...list[i], status: 'subscribed' }; return list; }
      return [...list, { email, status: 'subscribed', source: 'manual', createdAt: now }];
    });
    return json(200, { ok: true, subscribers: next });
  }

  if (event.httpMethod === 'DELETE') {
    const next = await updateArray('subscribers', (list) => list.filter((s) => s.email !== email));
    return json(200, { ok: true, subscribers: next });
  }

  return json(405, { error: 'Method not allowed' });
};
