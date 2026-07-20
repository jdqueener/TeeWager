import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  const body = await req.json().catch(() => null);
  const { token, password } = body ?? {};

  if (!token || !password || password.length < 8) {
    return new Response(JSON.stringify({ error: 'invalid request' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Look up partner by reset token
  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?reset_token=eq.${encodeURIComponent(token)}&select=id,reset_token_expires&limit=1`,
    { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
  );

  if (!lookup.ok) {
    return new Response(JSON.stringify({ error: 'server error' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const rows = await lookup.json();
  const partner = rows[0];

  if (!partner) {
    return new Response(JSON.stringify({ error: 'invalid or expired link' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Check expiry
  if (!partner.reset_token_expires || new Date(partner.reset_token_expires) < new Date()) {
    return new Response(JSON.stringify({ error: 'link expired' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Update password and clear the token
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
      body: JSON.stringify({
        portal_password: password,
        reset_token: null,
        reset_token_expires: null,
      }),
    }
  );

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
