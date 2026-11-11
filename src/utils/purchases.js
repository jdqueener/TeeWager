// Shared RevenueCat helpers for the three native paywall surfaces
// (PaywallModal, PostRoundScreen, AuthScreen). Wrapped with timeouts so a
// slow/unresponsive store call surfaces an error instead of spinning
// forever — the cause of Apple's "In-App Purchase products ... loaded the
// subscription plans indefinitely" rejection (Guideline 2.1(b)).
import { Platform } from 'react-native';

function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Ties RevenueCat's subscriber identity to the signed-in Supabase user (or
// back to an anonymous id on sign-out), so the server-side verify-purchase
// and revenuecat-webhook functions can look up "this RevenueCat purchase
// belongs to this account" — without this, RevenueCat's app_user_id is
// just a random id with no link back to profiles at all.
export async function syncPurchasesIdentity(userId) {
  if (Platform.OS === 'web') return;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    if (userId) await Purchases.logIn(userId);
    else await Purchases.logOut();
  } catch (e) {
    console.warn('RevenueCat identity sync failed', e);
  }
}

// profiles.is_pro is never set directly from the client (see
// supabase/migrations/lock_down_profiles_monetization_fields.sql) — a
// signed-in purchase is confirmed server-side by the verify-purchase edge
// function, which independently checks RevenueCat before granting Pro.
// Guests have no profiles row; their local storePro(true) flag (set by the
// caller) is the only unlock they need.
async function verifyAndGrantPro() {
  const { supabase } = await import('./supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  try {
    await supabase.functions.invoke('verify-purchase');
  } catch (e) {
    // Non-fatal: the revenuecat-webhook function reconciles profiles.is_pro
    // independently, and the local storePro(true) flag already unlocked
    // this device.
    console.warn('Pro verification failed', e);
  }
}

export async function purchaseProduct(packageIdentifier) {
  const Purchases = (await import('react-native-purchases')).default;
  const offerings = await withTimeout(
    Purchases.getOfferings(),
    15000,
    'Unable to load store information. Please check your connection and try again.'
  );
  const all = offerings.current?.availablePackages ?? [];
  // Matched on RevenueCat's own Package identifier (e.g. "$rc_monthly"), which
  // is the same across platforms — p.product.identifier is the underlying
  // store product id instead, which differs per platform (iOS uses reverse-DNS
  // ids, Android uses Play Console's own) and would never match on Android.
  const pkg = all.find(p => p.identifier === packageIdentifier);
  if (!pkg) throw new Error('Product not found');
  const { customerInfo } = await withTimeout(
    Purchases.purchasePackage(pkg),
    30000,
    'The purchase is taking longer than expected. Please try again.'
  );
  if (customerInfo.entitlements.active['pro']) {
    await verifyAndGrantPro();
  }
  return customerInfo;
}

export async function restorePro() {
  const Purchases = (await import('react-native-purchases')).default;
  const customerInfo = await withTimeout(
    Purchases.restorePurchases(),
    15000,
    'Unable to restore purchases. Please check your connection and try again.'
  );
  if (customerInfo.entitlements.active['pro']) {
    await verifyAndGrantPro();
  }
  return customerInfo;
}
