import * as AppleAuthentication from 'expo-apple-authentication';

// TEMP diagnostic — pinpoints which step hangs when Apple sign-in never
// resolves or rejects. Remove once the root cause is found.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms)),
  ]);
}

export async function signInWithAppleNative(supabase) {
  const credential = await withTimeout(
    AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    }),
    15000,
    'AppleAuthentication.signInAsync'
  );
  const { identityToken } = credential;
  if (!identityToken) throw new Error('Apple sign-in failed — no identity token.');
  const { error } = await withTimeout(
    supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: identityToken,
    }),
    15000,
    'supabase.auth.signInWithIdToken'
  );
  if (error) throw error;
}
