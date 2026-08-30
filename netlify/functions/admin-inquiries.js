// AUTHENTICATED — the CRM's Inquiries screen.
//   GET    /.netlify/functions/admin-inquiries              -> { inquiries }
//   PATCH  /.netlify/functions/admin-inquiries { id, status?, notes? }
//   DELETE /.netlify/functions/admin-inquiries { id }
import { requireAuth, json } from './_lib/auth.js';
import { getJSON, updateArray } from './_lib/store.js';

const STATUSES = ['new', 'contacted', 'booked', 'closed'];

export const handler = async (event) => {
  if (!requireAuth(event)) return json(401, { error: 'Not authorized' });

  if (event.httpMethod === 'GET') {
    return json(200, { inquiries: (await getJSON('inquiries', [])) || [] });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

  if (event.httpMethod === 'PATCH') {
    if (!body.id) return json(400, { error: 'Missing id' });
    const next = await updateArray('inquiries', (list) =>
      list.map((q) => {
        if (q.id !== body.id) return q;
        const updated = { ...q };
        if (body.status && STATUSES.includes(body.status)) updated.status = body.status;
        if (typeof body.notes === 'string') updated.notes = body.notes.slice(0, 4000);
        return updated;
      }));
    return json(200, { ok: true, inquiries: next });
  }

  if (event.httpMethod === 'DELETE') {
    if (!body.id) return json(400, { error: 'Missing id' });
    const next = await updateArray('inquiries', (list) => list.filter((q) => q.id !== body.id));
    return json(200, { ok: true, inquiries: next });
  }

  return json(405, { error: 'Method not allowed' });
};
