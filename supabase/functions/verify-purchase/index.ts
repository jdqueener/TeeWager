import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const REVENUECAT_SECRET_KEY = Deno.env.get('REVENUECAT_SECRET_KEY') ?? '';

// RevenueCat reports the underlying store product id here (not a package
// identifier), which differs per platform — iOS uses reverse-DNS ids, Android
// uses Play Console's own ids — so both need to be listed.
function planForProduct(productId: string | undefined): string | null {
  if (productId === 'io.teewager.app.pro.monthly'  || productId === 'teewager_monthly')  return 'monthly';
  if (productId === 'io.teewager.app.pro.annual'   || productId === 'teewager_annual')   return 'annual';
  if (productId === 'io.teewager.app.pro.lifetime' || productId === 'teewager_lifetime') return 'lifetime';
  return null;
}

async function grantPro(userId: string, plan: string | null) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ is_pro: true, ...(plan ? { plan } : {}) }),
  });
}

// Called by the app immediately after a native (RevenueCat) purchase
// resolves, for an instant cross-device Pro grant instead of waiting on
// webhook delivery. The revenuecat-webhook function is the real source of
// truth going forward (renewals, cancellations, expirations) — this is
// just the fast path for the moment of purchase.
serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  // Identify the caller from their own Supabase session — never trust a
  // client-supplied user id, or any signed-in user could grant Pro to an
  // arbitrary account.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: authHeader },
  });
  if (!userResp.ok) return new Response('unauthorized', { status: 401 });
  const user = await userResp.json();
  const userId = user?.id;
  if (!userId) return new Response('unauthorized', { status: 401 });

  // RevenueCat's app_user_id is set to the Supabase user id via
  // Purchases.logIn() (see src/utils/purchases.js's syncPurchasesIdentity),
  // so this looks up the same account that just purchased in the app —
  // never data the client supplies directly.
  const rcResp = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${REVENUECAT_SECRET_KEY}` },
  });
  if (!rcResp.ok) {
    return new Response(JSON.stringify({ is_pro: false, error: 'could not reach RevenueCat' }), { status: 502 });
  }
  const data = await rcResp.json();
  const entitlement = data?.subscriber?.entitlements?.pro;
  const active = !!entitlement && (!entitlement.expires_date || new Date(entitlement.expires_date) > new Date());

  if (active) {
    await grantPro(userId, planForProduct(entitlement.product_identifier));
  }

  return new Response(JSON.stringify({ is_pro: active }), { status: 200 });
});
