// Netlify Forms trigger — runs automatically whenever the contact form is
// submitted (the function name "submission-created" is the magic hook).
// It copies the inquiry into the CRM store and emails the owner an alert.
import crypto from 'node:crypto';
import { updateArray } from './_lib/store.js';
import { sendEmail } from './_lib/email.js';

export const handler = async (event) => {
  try {
    const payload = JSON.parse(event.body || '{}').payload || {};
    const d = payload.data || {};
    if (payload.form_name && payload.form_name !== 'contact') {
      return { statusCode: 200, body: 'ignored' };
    }

    const inquiry = {
      id: payload.id || crypto.randomUUID(),
      createdAt: payload.created_at || new Date().toISOString(),
      name: (d.name || '').slice(0, 200),
      phone: (d.phone || '').slice(0, 60),
      email: (d.email || '').slice(0, 254),
      property: (d.property || '').slice(0, 60),
      dates: (d.dates || '').slice(0, 120),
      message: (d.message || '').slice(0, 4000),
      status: 'new',
      notes: '',
    };

    await updateArray('inquiries', (list) => [inquiry, ...list].slice(0, 2000));

    const to = process.env.NOTIFY_EMAIL;
    if (to) {
      const line = (k, v) => (v ? `<p style="margin:2px 0"><b>${k}:</b> ${escapeHtml(v)}</p>` : '');
      await sendEmail({
        to,
        replyTo: inquiry.email || undefined,
        subject: `New inquiry — ${inquiry.name || 'Website'}${inquiry.property ? ' · ' + inquiry.property : ''}`,
        html: `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;color:#2b2b2b">
          <h2 style="color:#354830">New website inquiry</h2>
          ${line('Name', inquiry.name)}
          ${line('Phone', inquiry.phone)}
          ${line('Email', inquiry.email)}
          ${line('Property', inquiry.property)}
          ${line('Dates', inquiry.dates)}
          ${line('Message', inquiry.message)}
          <p style="margin-top:14px"><a href="https://stayatbankstreet.com/admin/#inquiries">Open in the CRM &rarr;</a></p>
        </div>`,
        text: `New inquiry\nName: ${inquiry.name}\nPhone: ${inquiry.phone}\nEmail: ${inquiry.email}\nProperty: ${inquiry.property}\nDates: ${inquiry.dates}\nMessage: ${inquiry.message}`,
      });
    }
  } catch (err) {
    console.error('submission-created error:', err);
  }
  // Always 200 — never make Netlify retry a form submission.
  return { statusCode: 200, body: 'ok' };
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
