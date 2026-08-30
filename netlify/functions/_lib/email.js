// Email sending via Resend (https://resend.com) + unsubscribe-token helpers.
//
// Required env (set once the owner has a Resend account + verified domain):
//   RESEND_API_KEY  — from the Resend dashboard
//   RESEND_FROM     — verified sender, e.g. "Bank Street Quarters <hello@stayatbankstreet.com>"
//   NOTIFY_EMAIL    — where new-inquiry alerts go (the owner's inbox)
//
// Until those are set, sendEmail() no-ops gracefully so the rest of the CRM
// keeps working (inquiries are still captured, subscribers still collected).
import crypto from 'node:crypto';

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

export async function sendEmail({ to, subject, html, text, replyTo, headers }) {
  if (!emailConfigured()) return { ok: false, skipped: true, reason: 'email not configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        reply_to: replyTo,
        headers,
      }),
    });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// Unsubscribe tokens: HMAC of the email so links can't be forged, and no
// per-subscriber secret needs storing.
export function subToken(email) {
  const secret = process.env.SESSION_SECRET || 'bsq';
  return crypto.createHmac('sha256', secret).update(String(email).toLowerCase()).digest('base64url');
}

export function verifySubToken(email, token) {
  if (!email || !token) return false;
  const expected = subToken(email);
  const a = Buffer.from(String(token)), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim()) && s.length <= 254;
}
