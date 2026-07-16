import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: CORS });
  }

  const body = await req.json().catch(() => null);
  if (!body?.email || !body?.password) {
    return new Response(JSON.stringify({ error: 'email and password required' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { email, password } = body;

  // Look up partner using service role key — password never appears in a URL
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/partners?email=eq.${encodeURIComponent(email.toLowerCase())}&select=*`,
    {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    }
  );

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'lookup failed' }), {
      status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const rows = await res.json();
  const partner = Array.isArray(rows) && rows[0];

  if (!partner || partner.portal_password !== password) {
    return new Response(JSON.stringify({ error: 'invalid credentials' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Strip the password before returning to the client
  const { portal_password: _pw, ...safePartner } = partner;
  return new Response(JSON.stringify(safePartner), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
