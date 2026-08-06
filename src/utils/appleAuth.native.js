import * as AppleAuthentication from 'expo-apple-authentication';

export async function signInWithAppleNative(supabase) {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  const { identityToken } = credential;
  if (!identityToken) throw new Error('Apple sign-in failed — no identity token.');
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw error;
}
