import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const PARTNER_ACCESS_CODE  = Deno.env.get('PARTNER_ACCESS_CODE') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED_FIELDS = ['course_name', 'city', 'state', 'mailing_address', 'course_type', 'first_name', 'last_name', 'email', 'payout_method'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  const body = await req.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: 'invalid request body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { access_code, portal_password, ...fields } = body;

  // The access code check that used to live in client JS (and be shown as the
  // input's placeholder) now happens here, server-side, against a secret that
  // is never shipped to the browser.
  if (!PARTNER_ACCESS_CODE || typeof access_code !== 'string' || access_code.trim().toLowerCase() !== PARTNER_ACCESS_CODE.toLowerCase()) {
    return new Response(JSON.stringify({ error: 'invalid access code' }), {
      status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  for (const f of REQUIRED_FIELDS) {
    if (!fields[f]) {
      return new Response(JSON.stringify({ error: `missing required field: ${f}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }

  if (!portal_password || portal_password.length < 8) {
    return new Response(JSON.stringify({ error: 'password must be at least 8 characters' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const hashedPassword = bcrypt.hashSync(portal_password, 10);

  const payload = { ...fields, email: String(fields.email).toLowerCase(), portal_password: hashedPassword };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/partners`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('partner-signup insert failed', err);
    return new Response(JSON.stringify({ error: 'signup failed' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
