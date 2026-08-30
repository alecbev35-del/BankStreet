// PUBLIC — one-click unsubscribe (linked at the bottom of every campaign).
//   GET /.netlify/functions/unsubscribe?e=<email>&t=<token>
// Returns a small HTML confirmation page. Token is an HMAC of the email so the
// link can't be forged for arbitrary addresses.
import { updateArray } from './_lib/store.js';
import { verifySubToken } from './_lib/email.js';

export const handler = async (event) => {
  const q = event.queryStringParameters || {};
  const email = String(q.e || '').trim().toLowerCase();
  const token = String(q.t || '');

  if (!email || !verifySubToken(email, token)) {
    return page('This unsubscribe link is invalid or expired.', false);
  }

  await updateArray('subscribers', (list) =>
    list.map((s) => (s.email === email ? { ...s, status: 'unsubscribed', unsubscribedAt: new Date().toISOString() } : s)));

  return page("You're unsubscribed. You won't receive further emails from Bank Street Quarters.", true);
};

function page(message, ok) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Unsubscribe — Bank Street Quarters</title>
    <style>
      body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4efe1;
        font-family:Georgia,'Times New Roman',serif;color:#354830;padding:24px}
      .card{max-width:460px;text-align:center;background:#fff;border:1px solid #dcd6c4;
        border-radius:14px;padding:2.5rem 2rem;box-shadow:0 10px 30px rgba(0,0,0,.08)}
      h1{font-size:1.5rem;margin:0 0 .5rem}p{font-size:1.05rem;line-height:1.5;color:#4a5a44}
      a{color:#354830}
    </style></head><body><div class="card">
      <h1>${ok ? 'Unsubscribed' : 'Hmm'}</h1><p>${message}</p>
      <p><a href="https://stayatbankstreet.com/">Return to Bank Street Quarters</a></p>
    </div></body></html>`;
  return { statusCode: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, body: html };
}
