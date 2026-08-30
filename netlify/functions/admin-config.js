// AUTHENTICATED — the CRM reads and writes site config (prices + review counts).
//   GET   /.netlify/functions/admin-config           -> current merged config
//   PUT   /.netlify/functions/admin-config  { ... }   -> save config
import { requireAuth, json } from './_lib/auth.js';
import { getJSON, setJSON } from './_lib/store.js';
import { mergeConfig } from './_lib/defaults.js';

// Coerce a money field to a positive integer or null (blank clears it).
function money(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Math.round(Number(String(v).replace(/[^0-9.]/g, '')));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export const handler = async (event) => {
  if (!requireAuth(event)) return json(401, { error: 'Not authorized' });

  if (event.httpMethod === 'GET') {
    return json(200, mergeConfig(await getJSON('config', null)));
  }

  if (event.httpMethod === 'PUT') {
    let incoming = {};
    try { incoming = JSON.parse(event.body || '{}'); } catch {
      return json(400, { error: 'Invalid JSON' });
    }
    // Start from the current merged config, apply validated fields only.
    const cfg = mergeConfig(await getJSON('config', null));
    const p = incoming.prices || {};
    if (p.mint) cfg.prices.mint.nightly = money(p.mint.nightly);
    if (p.vault) cfg.prices.vault.nightly = money(p.vault.nightly);
    if (p.trust) cfg.prices.trust.monthly = money(p.trust.monthly);
    if (p.teller) cfg.prices.teller.monthly = money(p.teller.monthly);

    const r = incoming.reviews || {};
    for (const unit of ['mint', 'vault']) {
      if (r[unit]) {
        const cur = cfg.reviews[unit];
        cur.score = String(r[unit].score ?? cur.score).slice(0, 8);
        cur.scale = String(r[unit].scale ?? cur.scale).slice(0, 4);
        cur.label = String(r[unit].label ?? cur.label).slice(0, 40);
        const c = parseInt(r[unit].count, 10);
        cur.count = Number.isFinite(c) && c >= 0 ? c : cur.count;
      }
    }

    await setJSON('config', cfg);
    return json(200, { ok: true, config: cfg });
  }

  return json(405, { error: 'Method not allowed' });
};
