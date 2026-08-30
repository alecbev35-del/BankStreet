// PUBLIC — email-list signup from the website footer.
//   POST /.netlify/functions/subscribe  { email, source? }
import { updateArray, getJSON } from './_lib/store.js';
import { isEmail } from './_lib/email.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return resp(405, { error: 'Method not allowed' });

  let email = '', source = 'website';
  try {
    const b = JSON.parse(event.body || '{}');
    email = String(b.email || '').trim().toLowerCase();
    if (b.source) source = String(b.source).slice(0, 40);
    if (b.company) return resp(200, { ok: true }); // honeypot: silently accept, don't store
  } catch {}

  if (!isEmail(email)) return resp(400, { error: 'Please enter a valid email.' });

  const existing = (await getJSON('subscribers', [])) || [];
  const found = existing.find((s) => s.email === email);
  if (found && found.status === 'subscribed') {
    return resp(200, { ok: true, already: true });
  }

  await updateArray('subscribers', (list) => {
    const now = new Date().toISOString();
    const i = list.findIndex((s) => s.email === email);
    if (i >= 0) {
      list[i] = { ...list[i], status: 'subscribed', resubscribedAt: now };
      return list;
    }
    return [...list, { email, status: 'subscribed', source, createdAt: now }];
  });

  return resp(200, { ok: true });
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body),
  };
}
