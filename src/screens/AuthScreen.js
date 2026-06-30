import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../utils/theme';

export default function AuthScreen({ onSkip }) {
  const { signUp, signIn } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    if (!email.trim() || !password) { setError('Enter an email and password.'); return; }
    if (mode === 'signup' && !name.trim()) { setError('Enter a display name.'); return; }
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

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>⛳</Text>
        <Text style={styles.title}>TeeWager</Text>
        <Text style={styles.sub}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</Text>

        {mode === 'signup' && (
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor={colors.textLight}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textLight}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textLight}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={busy}>
          {busy
            ? <ActivityIndicator color={colors.white} />
            : <Text style={styles.submitText}>{mode === 'signup' ? 'Sign Up' : 'Sign In'}</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); }}>
          <Text style={styles.switchText}>
            {mode === 'signup' ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </Text>
        </TouchableOpacity>

        {onSkip && (
          <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
            <Text style={styles.skipText}>Continue without an account</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl },
  logo:    { fontSize: 48, textAlign: 'center', marginBottom: spacing.xs },
  title:   { fontSize: 30, fontWeight: '900', color: colors.green, textAlign: 'center' },
  sub:     { fontSize: 15, color: colors.textMid, textAlign: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  input:   { backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 16, color: colors.textDark, marginBottom: spacing.sm },
  error:   { color: colors.red, fontSize: 13, marginBottom: spacing.sm, textAlign: 'center' },
  submitBtn:  { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', marginTop: spacing.xs },
  submitText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  switchText: { color: colors.green, fontWeight: '600', fontSize: 14, textAlign: 'center', marginTop: spacing.md },
  skipBtn:    { marginTop: spacing.lg, alignItems: 'center' },
  skipText:   { color: colors.textLight, fontSize: 13, textDecorationLine: 'underline' },
});
