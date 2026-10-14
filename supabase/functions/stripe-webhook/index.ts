import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'npm:stripe@14';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();

async function grantPro(userId: string, plan: string | null) {
  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ is_pro: true, ...(plan ? { plan } : {}) }),
  });
}

// The checkout session has no price-ID lookup table anywhere in this
// codebase (only the Payment Link URLs are known), but the three plans
// have distinct amounts and modes, which the snapshot event already
// includes — no extra Stripe API call needed.
function planForSession(session: { mode?: string; amount_total?: number | null }): string | null {
  const amount = session.amount_total;
  if (session.mode === 'payment' && amount === 7999) return 'lifetime';
  if (session.mode === 'subscription' && amount === 499) return 'monthly';
  if (session.mode === 'subscription' && amount === 4990) return 'annual';
  return null;
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  // Stripe signature verification needs the exact raw body — never parse
  // it as JSON first, that changes the bytes and breaks the signature.
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, signature!, STRIPE_WEBHOOK_SECRET, undefined, cryptoProvider
    );
  } catch (err) {
    console.error('Stripe signature verification failed', err);
    return new Response(`signature verification failed: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      client_reference_id?: string | null;
      payment_status?: string;
      mode?: string;
      amount_total?: number | null;
    };

    // client_reference_id is set by the app when it opens the Stripe link
    // (?client_reference_id=<supabase user id>) — without it there's no way
    // to know which account just paid.
    const userId = session.client_reference_id;

    // 'paid' covers both one-time (Lifetime) and subscription (Monthly/
    // Annual) checkouts; async payment methods can complete this event
    // before funds actually clear, so don't grant Pro for those yet.
    if (userId && session.payment_status === 'paid') {
      await grantPro(userId, planForSession(session));
    } else if (!userId) {
      console.error('checkout.session.completed with no client_reference_id', event.id);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
