import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import bcrypt from 'npm:bcryptjs@2.4.3';

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

  if (!partner) {
    return new Response(JSON.stringify({ error: 'invalid credentials' }), {
      status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const stored = partner.portal_password ?? '';
  const isHashed = stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$');
  let valid = false;

  if (isHashed) {
    valid = bcrypt.compareSync(password, stored);
  } else {
    // Legacy plaintext row (pre-dating password hashing). Verify directly,
    // then transparently upgrade it to a bcrypt hash so it's never compared
    // in plaintext again.
    valid = stored === password;
    if (valid) {
      const upgraded = bcrypt.hashSync(password, 10);
      await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${partner.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ portal_password: upgraded }),
      }).catch((e) => console.error('password upgrade failed', e));
    }
  }

  if (!valid) {
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
