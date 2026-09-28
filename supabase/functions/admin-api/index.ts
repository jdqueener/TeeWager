import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_PASSWORD       = Deno.env.get('ADMIN_PASSWORD') ?? '';
const ADMIN_TOKEN_SECRET   = Deno.env.get('ADMIN_TOKEN_SECRET') ?? '';
const TOKEN_TTL_SECONDS    = 60 * 60 * 12; // 12 hours

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const encoder = new TextEncoder();

async function hmacHex(message: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(ADMIN_TOKEN_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function makeToken() {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  return `${exp}.${await hmacHex(String(exp))}`;
}

async function verifyToken(token: unknown) {
  if (typeof token !== 'string' || !token.includes('.')) return false;
  const [expStr, sig] = token.split('.');
  const exp = parseInt(expStr, 10);
  if (!exp || Math.floor(Date.now() / 1000) > exp) return false;
  return (await hmacHex(expStr)) === sig;
}

async function svc(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  if (!ADMIN_PASSWORD || !ADMIN_TOKEN_SECRET) {
    return json({ error: 'server not configured' }, 500);
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) return json({ error: 'missing action' }, 400);

  if (body.action === 'login') {
    if (typeof body.password !== 'string' || body.password !== ADMIN_PASSWORD) {
      return json({ error: 'invalid credentials' }, 401);
    }
    return json({ token: await makeToken() });
  }

  if (!(await verifyToken(body.token))) {
    return json({ error: 'unauthorized' }, 401);
  }

  switch (body.action) {
    // Used by both /dashboard (partner-performance view) and /admin (full CRM) —
    // both used to hit /rest/v1/partners and /rest/v1/profiles directly with
    // the anon key, gated only by a client-side password check.
    case 'list': {
      const [partnersRes, profilesRes] = await Promise.all([
        svc('partners?select=*&order=created_at.desc'),
        svc('profiles?select=id,display_name,email,referred_by,created_at&referred_by=not.is.null'),
      ]);
      if (!partnersRes.ok || !profilesRes.ok) {
        const partnersErr = partnersRes.ok ? null : await partnersRes.text();
        const profilesErr = profilesRes.ok ? null : await profilesRes.text();
        console.error('list lookup failed', { partnersStatus: partnersRes.status, partnersErr, profilesStatus: profilesRes.status, profilesErr });
        return json({ error: 'lookup failed', partnersStatus: partnersRes.status, partnersErr, profilesStatus: profilesRes.status, profilesErr }, 502);
      }
      return json({ partners: await partnersRes.json(), profiles: await profilesRes.json() });
    }

    // Generic partial update, used for status, notes, outreach fields, contact
    // edits, etc. portal_password is never settable through this path — use
    // clear-password/mark-registered, which express that intent explicitly.
    case 'update': {
      const { id, fields } = body;
      if (!id || !fields || typeof fields !== 'object') return json({ error: 'id and fields required' }, 400);
      const { portal_password: _pw, id: _id, created_at: _ca, ...safeFields } = fields;
      const r = await svc(`partners?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(safeFields),
      });
      if (!r.ok) return json({ error: await r.text() }, 502);
      return json({ ok: true });
    }

    case 'create': {
      const { fields } = body;
      if (!fields || typeof fields !== 'object') return json({ error: 'fields required' }, 400);
      const { portal_password: _pw, id: _id, ...safeFields } = fields;
      const r = await svc('partners', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(safeFields),
      });
      if (!r.ok) return json({ error: await r.text() }, 502);
      return json({ ok: true });
    }

    case 'delete': {
      const { id } = body;
      if (!id) return json({ error: 'id required' }, 400);
      const r = await svc(`partners?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) return json({ error: await r.text() }, 502);
      return json({ ok: true });
    }

    case 'clear-password': {
      const { id } = body;
      if (!id) return json({ error: 'id required' }, 400);
      const r = await svc(`partners?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ portal_password: null }),
      });
      if (!r.ok) return json({ error: await r.text() }, 502);
      return json({ ok: true });
    }

    case 'mark-registered': {
      const { id } = body;
      if (!id) return json({ error: 'id required' }, 400);
      const r = await svc(`partners?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ portal_password: null, status: 'registered' }),
      });
      if (!r.ok) return json({ error: await r.text() }, 502);
      return json({ ok: true });
    }

    default:
      return json({ error: 'unknown action' }, 400);
  }
});
