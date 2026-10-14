import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const REQUIRED_FIELDS = ['course_name', 'physical_address', 'city', 'state', 'course_type', 'first_name', 'last_name', 'email', 'payout_method'];

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: CORS });

  const body = await req.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ error: 'invalid request body' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { portal_password, ...fields } = body;

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

  // If this submission carries a referral_code (from the ?ref= link the CRM
  // generates when a partner lead is added), it should complete that existing
  // CRM row, not create a duplicate one — the CRM's own drawer already treats
  // portal_password being set as "partner self-registered" on that same row.
  let existingId: string | null = null;
  if (fields.referral_code) {
    const lookupRes = await fetch(
      `${SUPABASE_URL}/rest/v1/partners?referral_code=eq.${encodeURIComponent(fields.referral_code)}&select=id`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    ).catch(() => null);
    if (lookupRes?.ok) {
      const rows = await lookupRes.json();
      if (Array.isArray(rows) && rows[0]) existingId = rows[0].id;
    }
  }

  const res = existingId
    ? await fetch(`${SUPABASE_URL}/rest/v1/partners?id=eq.${existingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        // Self-registration against a known CRM lead completes the whole
        // pipeline in one step — same effect as admin's manual "Convert to
        // Active Partner" button (admin.html's convertToPartner()), so a
        // partner doesn't sit at "registered" waiting on a human to promote
        // them before they show up on the live Partner Dashboard.
        body: JSON.stringify({ ...payload, status: 'active', outreach_stage: null, outreach_last_date: null }),
      })
    : await fetch(`${SUPABASE_URL}/rest/v1/partners`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=minimal',
        },
        // No matching CRM lead — either they had no code, checked "I don't
        // have a code", or typed one that doesn't match anything on file.
        // Flag it so the CRM surfaces it for a human to find/create and link.
        body: JSON.stringify({ ...payload, status: 'needs_review' }),
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
