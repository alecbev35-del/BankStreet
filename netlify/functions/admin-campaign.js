// AUTHENTICATED — compose & send an email campaign to the list, and read history.
//   GET  /.netlify/functions/admin-campaign                       -> { campaigns }
//   POST /.netlify/functions/admin-campaign { subject, body, test? }
//        test = an email address -> sends only to that address as a preview.
import { requireAuth, json } from './_lib/auth.js';
import { getJSON, updateArray } from './_lib/store.js';
import { emailConfigured, subToken, isEmail } from './_lib/email.js';
import crypto from 'node:crypto';

const SITE = 'https://stayatbankstreet.com';

export const handler = async (event) => {
  if (!requireAuth(event)) return json(401, { error: 'Not authorized' });

  if (event.httpMethod === 'GET') {
    return json(200, { campaigns: (await getJSON('campaigns', [])) || [], emailConfigured: emailConfigured() });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  if (!emailConfigured()) {
    return json(400, { error: 'Email is not connected yet. Add RESEND_API_KEY and RESEND_FROM in Netlify, then try again.' });
  }

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }
  const subject = String(body.subject || '').trim().slice(0, 200);
  const messageBody = String(body.body || '').trim();
  if (!subject) return json(400, { error: 'Subject is required' });
  if (!messageBody) return json(400, { error: 'Message body is required' });

  // Recipients: a single test address, or every active subscriber.
  let recipients;
  if (body.test) {
    if (!isEmail(body.test)) return json(400, { error: 'Invalid test address' });
    recipients = [String(body.test).trim().toLowerCase()];
  } else {
    const subs = (await getJSON('subscribers', [])) || [];
    recipients = subs.filter((s) => s.status === 'subscribed').map((s) => s.email);
  }
  if (recipients.length === 0) return json(400, { error: 'No subscribers to send to yet.' });

  const results = { sent: 0, failed: 0 };
  // Resend batch endpoint accepts up to 100 messages per call.
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const batch = chunk.map((email) => {
      const unsub = `${SITE}/.netlify/functions/unsubscribe?e=${encodeURIComponent(email)}&t=${subToken(email)}`;
      return {
        from: process.env.RESEND_FROM,
        to: [email],
        subject,
        html: renderEmail(subject, messageBody, unsub),
        text: `${stripHtml(messageBody)}\n\nUnsubscribe: ${unsub}`,
        headers: { 'List-Unsubscribe': `<${unsub}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      };
    });
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) results.sent += chunk.length; else results.failed += chunk.length;
    } catch {
      results.failed += chunk.length;
    }
  }

  // Log real campaigns (not test previews).
  if (!body.test) {
    await updateArray('campaigns', (list) => [{
      id: crypto.randomUUID(),
      subject,
      sentAt: new Date().toISOString(),
      recipients: recipients.length,
      sent: results.sent,
      failed: results.failed,
    }, ...list].slice(0, 500));
  }

  return json(200, { ok: true, test: Boolean(body.test), ...results });
};

function renderEmail(subject, bodyHtml, unsubUrl) {
  return `<!doctype html><html><body style="margin:0;background:#f4efe1;padding:24px 0;font-family:Georgia,'Times New Roman',serif;color:#2b3327">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <table role="presentation" width="600" style="max-width:600px;background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2dcc9">
        <tr><td style="background:#354830;padding:22px 28px;color:#f4efe1;font-size:20px;letter-spacing:.04em">Bank Street Quarters</td></tr>
        <tr><td style="padding:28px;font-size:16px;line-height:1.6">${bodyHtml}</td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #eee;font-size:12px;color:#8a8a7a;line-height:1.5">
          Bank Street Quarters · 12 Bank Street, Bristol, TN<br>
          <a href="${unsubUrl}" style="color:#8a8a7a">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr></table></body></html>`;
}

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}
