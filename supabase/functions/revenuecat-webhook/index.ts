import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REVENUECAT_WEBHOOK_TOKEN = Deno.env.get('REVENUECAT_WEBHOOK_TOKEN') ?? '';

// RevenueCat reports the underlying store product id here (not a package
// identifier), which differs per platform — iOS uses reverse-DNS ids, Android
// uses Play Console's own ids, with the base plan id appended after a colon
// for subscriptions (e.g. "teewager_monthly:monthly-499") — so both need to
// be listed, and Android ones are matched on the part before the colon since
// the base plan id can change independently of the product itself.
function planForProduct(productId: string | undefined): string | null {
  const base = productId?.split(':')[0];
  if (base === 'io.teewager.app.pro.monthly'  || base === 'teewager_monthly')  return 'monthly';
  if (base === 'io.teewager.app.pro.annual'   || base === 'teewager_annual')   return 'annual';
  if (base === 'io.teewager.app.pro.lifetime' || base === 'teewager_lifetime') return 'lifetime';
  return null;
}

async function setPro(userId: string, isPro: boolean, plan: string | null) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ is_pro: isPro, ...(plan ? { plan } : {}) }),
  });
}

const GRANT_EVENTS  = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION', 'NON_RENEWING_PURCHASE', 'TRANSFER']);
const REVOKE_EVENTS = new Set(['EXPIRATION']);

// Configured as a Webhook in the RevenueCat dashboard (Project Settings →
// Integrations → Webhooks), with REVENUECAT_WEBHOOK_TOKEN set as the
// "Authorization header value" there too. This is the source of truth for
// profiles.is_pro going forward — it's what actually revokes access on
// expiration, which nothing in the app did before this. verify-purchase is
// just the fast path for the moment of purchase; this covers renewals,
// cancellations, and expirations whether or not the app is even open.
serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const auth = req.headers.get('Authorization') ?? '';
  if (!REVENUECAT_WEBHOOK_TOKEN || auth !== `Bearer ${REVENUECAT_WEBHOOK_TOKEN}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const payload = await req.json();
  const event = payload?.event;
  const userId = event?.app_user_id;
  if (!userId) return new Response(JSON.stringify({ received: true }), { status: 200 });

  // app_user_id is only a real Supabase user id for signed-in purchases
  // (see Purchases.logIn() in src/utils/purchases.js) — anonymous/guest
  // purchases use RevenueCat's own generated id and have no profiles row to
  // update, which is fine: guests already unlock Pro locally on-device.
  if (GRANT_EVENTS.has(event.type)) {
    await setPro(userId, true, planForProduct(event.product_id));
  } else if (REVOKE_EVENTS.has(event.type)) {
    await setPro(userId, false, null);
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
