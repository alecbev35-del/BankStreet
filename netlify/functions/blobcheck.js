// TEMPORARY diagnostic — remove after verifying Blobs. Reports whether the
// Netlify Blobs runtime context is present and whether a round-trip works.
// Does not expose any secret values.
import { getStore } from '@netlify/blobs';

export const handler = async () => {
  const out = {
    hasBlobsContext: Boolean(process.env.NETLIFY_BLOBS_CONTEXT),
    hasSiteId: Boolean(process.env.SITE_ID || process.env.NETLIFY_SITE_ID),
    node: process.version,
  };
  try {
    const s = getStore('crm');
    await s.setJSON('__blobcheck', { t: Date.now() });
    const back = await s.get('__blobcheck', { type: 'json' });
    out.roundTrip = Boolean(back);
    out.ok = true;
  } catch (err) {
    out.ok = false;
    out.error = String((err && err.message) || err);
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(out),
  };
};
