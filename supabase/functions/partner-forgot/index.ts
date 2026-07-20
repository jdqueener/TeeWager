import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM_EMAIL        = 'TeeWager <noreply@teewager.io>';
const PORTAL_URL        = 'https://www.teewager.io/portal';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();

  // Always return 200 — never reveal whether email is on file
  const ok = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

  if (!email || !email.includes('@')) return ok;

  // Look up partner
  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?email=eq.${encodeURIComponent(email)}&select=id,first_name,email&limit=1`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );
  if (!lookup.ok) return ok;
  const rows = await lookup.json();
  const partner = rows[0];
  if (!partner) return ok;

  // Generate a secure random token and 1-hour expiry
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  // Store token in partners table
  await fetch(
    `${SUPABASE_URL}/rest/v1/partners?id=eq.${partner.id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ reset_token: token, reset_token_expires: expires }),
    }
  );

  const resetLink = `${PORTAL_URL}?reset=${token}`;
  const name = partner.first_name || 'there';

  const html = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;color:#3D3D3D">
  <div style="background:#1A4A2E;padding:24px 32px;border-radius:12px 12px 0 0">
    <p style="margin:0;font-size:20px;font-weight:700;color:#fff">⛳ TeeWager Partner Portal</p>
  </div>
  <div style="background:#fff;border:1px solid #EDE0C0;border-top:none;padding:32px;border-radius:0 0 12px 12px">
    <p style="margin:0 0 16px">Hi ${name},</p>
    <p style="margin:0 0 24px;color:#555">We received a request to reset your partner portal password. Click the button below — the link expires in <strong>1 hour</strong>.</p>
    <a href="${resetLink}" style="display:inline-block;background:#1A4A2E;color:#fff;padding:13px 26px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none">Reset my password →</a>
    <p style="margin:24px 0 0;font-size:12px;color:#999">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
    <p style="margin:8px 0 0;font-size:12px;color:#bbb;word-break:break-all">Link: ${resetLink}</p>
  </div>
</div>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [partner.email],
      subject: 'Reset your TeeWager partner portal password',
      html,
    }),
  });

  return ok;
});
