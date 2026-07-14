import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_EMAIL   = 'hello@teewager.io';
const FROM_EMAIL     = 'TeeWager <noreply@teewager.io>';

serve(async (req) => {
  // Supabase webhooks send a POST with the row as JSON
  const body = await req.json().catch(() => null);
  if (!body) return new Response('bad request', { status: 400 });

  // Database webhook payload: { type, table, record, old_record, schema }
  const partner = body.record ?? body;

  const courseName  = partner.course_name  ?? '(unknown course)';
  const contactName = [partner.first_name, partner.last_name].filter(Boolean).join(' ') || '(no name)';
  const email       = partner.email        ?? '(no email)';
  const city        = partner.city         ?? '';
  const state       = partner.state        ?? '';
  const location    = [city, state].filter(Boolean).join(', ') || '—';
  const payout      = partner.payout_method ?? '—';
  const createdAt   = partner.created_at
    ? new Date(partner.created_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })
    : 'just now';

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#3D3D3D">
  <div style="background:#1A4A2E;padding:24px 32px;border-radius:12px 12px 0 0">
    <p style="margin:0;font-size:20px;font-weight:700;color:#fff">⛳ New partner registered</p>
  </div>
  <div style="background:#fff;border:1px solid #EDE0C0;border-top:none;padding:24px 32px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:8px 0;color:#666;width:40%">Course</td><td style="padding:8px 0;font-weight:600">${courseName}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Location</td><td style="padding:8px 0">${location}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Contact</td><td style="padding:8px 0">${contactName}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#1A4A2E">${email}</a></td></tr>
      <tr><td style="padding:8px 0;color:#666">Payout method</td><td style="padding:8px 0">${payout}</td></tr>
      <tr><td style="padding:8px 0;color:#666">Registered at</td><td style="padding:8px 0">${createdAt} PT</td></tr>
    </table>
    <div style="margin-top:20px">
      <a href="https://www.teewager.io/admin" style="display:inline-block;background:#1A4A2E;color:#fff;padding:11px 22px;border-radius:8px;font-weight:700;font-size:14px;text-decoration:none">View in admin dashboard →</a>
    </div>
  </div>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to:   [NOTIFY_EMAIL],
      subject: `New partner: ${courseName} (${location})`,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error', err);
    return new Response(err, { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
