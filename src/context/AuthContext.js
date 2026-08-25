import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../utils/supabase';
import { signInWithAppleNative } from '../utils/appleAuth';
import { getReferral, clearReferral } from '../utils/referral';
import { pullUserData, clearLocalUserData } from '../utils/cloudSync';

WebBrowser.maybeCompleteAuthSession();

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setProfile(null); return; }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(data);
      pullUserData(session.user.id).catch(() => {});
    })();
  }, [session]);

  async function signUp(email, password, fullName, scoringName) {
    const ref = getReferral();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'https://www.teewager.io/app',
        data: {
          full_name: fullName,
          scoring_name: scoringName,
          ...(ref ? { referred_by: ref } : {}),
        },
      },
    });
    if (error) throw error;
    if (ref) clearReferral();
    return data;
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    await clearLocalUserData();
    await supabase.auth.signOut();
  }

  async function forgotPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://www.teewager.io/app?mode=reset',
    });
    if (error) throw error;
  }

  async function signInWithGoogle() {
    const redirectTo = Linking.createURL('/');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      await supabase.auth.exchangeCodeForSession(result.url);
    } else {
      // Browser dismissed without redirect — check if a session was set via deep link
      await supabase.auth.getSession();
    }
  }

  async function signInWithApple() {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo: 'https://www.teewager.io/app' },
      });
      if (error) throw error;
      return;
    }
    await signInWithAppleNative(supabase);
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  }

  async function deleteAccount() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not signed in.');
    // Call a Supabase Edge Function or RPC to delete the user server-side
    const { error } = await supabase.rpc('delete_user');
    if (error) throw error;
    await clearLocalUserData();
    await supabase.auth.signOut();
  }

  async function updateProfile(fields) {
    if (!session?.user) return;
    const { data, error } = await supabase
      .from('profiles')
      .update(fields)
      .eq('id', session.user.id)
      .select()
      .single();
    if (error) throw error;
    setProfile(data);
    return data;
  }

  return (
    <AuthContext.Provider value={{
      session, profile, loading,
      user: session?.user ?? null,
      signUp, signIn, signOut, updateProfile, forgotPassword, signInWithGoogle, signInWithApple, updatePassword, deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
