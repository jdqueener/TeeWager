// Shared RevenueCat helpers for the three native paywall surfaces
// (PaywallModal, PostRoundScreen, AuthScreen). Wrapped with timeouts so a
// slow/unresponsive store call surfaces an error instead of spinning
// forever — the cause of Apple's "In-App Purchase products ... loaded the
// subscription plans indefinitely" rejection (Guideline 2.1(b)).

function withTimeout(promise, ms, timeoutMessage) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function purchaseProduct(productId) {
  const Purchases = (await import('react-native-purchases')).default;
  const offerings = await withTimeout(
    Purchases.getOfferings(),
    15000,
    'Unable to load store information. Please check your connection and try again.'
  );
  const all = offerings.current?.availablePackages ?? [];
  const pkg = all.find(p => p.product.identifier === productId);
  if (!pkg) throw new Error('Product not found');
  const { customerInfo } = await withTimeout(
    Purchases.purchasePackage(pkg),
    30000,
    'The purchase is taking longer than expected. Please try again.'
  );
  return customerInfo;
}

export async function restorePro() {
  const Purchases = (await import('react-native-purchases')).default;
  return withTimeout(
    Purchases.restorePurchases(),
    15000,
    'Unable to restore purchases. Please check your connection and try again.'
  );
}
