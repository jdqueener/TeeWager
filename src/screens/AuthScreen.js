import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../utils/theme';

export default function AuthScreen({ onSkip }) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!email.trim() || !password) { setError('Enter an email and password.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Enter a display name.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, name.trim());
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  const isSignUp = mode === 'signup';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>⛳</Text>
        <Text style={styles.heroTitle}>TeeWager</Text>
        <Text style={styles.heroSub}>Friendly wagers. Every round.</Text>
      </View>

      {/* Form card */}
      <KeyboardAvoidingView
        style={styles.cardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.card}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Mode toggle tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, !isSignUp && styles.tabActive]}
              onPress={() => { setMode('signin'); setError(''); }}
            >
              <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, isSignUp && styles.tabActive]}
              onPress={() => { setMode('signup'); setError(''); }}
            >
              <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formTitle}>
            {isSignUp ? 'Join TeeWager' : 'Welcome back'}
          </Text>

          {/* Inputs */}
          {isSignUp && (
            <View style={styles.inputWrap}>
              <Text style={styles.inputIcon}>👤</Text>
              <TextInput
                style={styles.input}
                placeholder="Display name"
                placeholderTextColor={colors.textLight}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
          )}

          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.textLight}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Password"
              placeholderTextColor={colors.textLight}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {!!error && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color={colors.white} />
              : <Text style={styles.submitText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            }
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {onSkip && (
            <TouchableOpacity style={styles.skipBtn} onPress={onSkip} activeOpacity={0.7}>
              <Text style={styles.skipText}>Continue without an account</Text>
            </TouchableOpacity>
          )}

          {isSignUp && (
            <Text style={styles.terms}>
              By creating an account you agree to our Terms of Service and Privacy Policy.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.green },

  // Hero
  hero:         { alignItems: 'center', paddingTop: 70, paddingBottom: 32, paddingHorizontal: spacing.xl },
  heroEmoji:    { fontSize: 52, marginBottom: spacing.sm },
  heroTitle:    { fontSize: 36, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  heroSub:      { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs },

  // Card
  cardWrap:     { flex: 1 },
  card:         { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: spacing.lg, paddingBottom: 44, flexGrow: 1 },

  // Tabs
  tabs:         { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill },
  tabActive:    { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText:      { fontSize: 14, fontWeight: '600', color: colors.textLight },
  tabTextActive:{ color: colors.textDark, fontWeight: '700' },

  formTitle:    { fontSize: 22, fontWeight: '800', color: colors.textDark, marginBottom: spacing.md },

  // Inputs
  inputWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  inputIcon:    { fontSize: 16, marginRight: spacing.xs, width: 24, textAlign: 'center' },
  input:        { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.textDark },
  eyeBtn:       { padding: spacing.sm },
  eyeIcon:      { fontSize: 16 },

  // Error
  errorWrap:    { backgroundColor: '#FEF2F2', borderRadius: radius.sm, borderWidth: 1, borderColor: '#FCA5A5', padding: spacing.sm, marginBottom: spacing.sm },
  errorText:    { fontSize: 13, color: '#DC2626', lineHeight: 18 },

  // Submit
  submitBtn:    { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xs },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:   { color: colors.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  // Divider
  divider:      { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dividerLine:  { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText:  { color: colors.textLight, fontSize: 13, marginHorizontal: spacing.sm },

  // Skip
  skipBtn:      { backgroundColor: colors.background, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  skipText:     { color: colors.textMid, fontWeight: '600', fontSize: 15 },

  terms:        { fontSize: 11, color: colors.textLight, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },
});
