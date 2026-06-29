import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Platform, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors, spacing, radius } from '../utils/theme';
import { setPro as storePro } from '../utils/storage';

// ── Stripe config ────────────────────────────────────────────────────────────
// 1. Create a Payment Link in your Stripe Dashboard (Products → Payment Links).
// 2. Set the "After payment" redirect URL to: teewager://pro-success
//    (or https://teewager.app/pro-success for web builds)
// 3. Paste the Payment Link URL here.
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/REPLACE_WITH_YOUR_PAYMENT_LINK';
// ─────────────────────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  '5 players (vs 4 free)',
  'All 13 built-in beans',
  'Custom bean creator',
  'Impromptu bean button mid-round',
  'Side wagers with settle-up',
  'Screenshot share card',
  'Hole-by-hole breakdown tab',
  'Lifetime stats tracker',
];

export default function PaywallModal({ visible, onClose, onUnlock }) {
  const [view, setView] = useState('main'); // 'main' | 'restore'
  const [email, setEmail] = useState('');
  const [restoreStatus, setRestoreStatus] = useState(''); // '' | 'loading' | 'success' | 'notfound'

  // Listen for the deep-link redirect from Stripe
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('pro-success')) {
        handleUnlock();
      }
    });
    return () => sub.remove();
  }, []);

  async function handlePurchase() {
    if (Platform.OS === 'web') {
      // On web, open in the same tab; Stripe redirects to the success URL
      window.location.href = STRIPE_PAYMENT_LINK;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(
        STRIPE_PAYMENT_LINK,
        'teewager://pro-success'
      );
      // openAuthSessionAsync resolves when the browser closes or redirects to our scheme
      if (result.type === 'success' && result.url?.includes('pro-success')) {
        handleUnlock();
      }
    }
  }

  async function handleUnlock() {
    await storePro(true);
    onUnlock();
    onClose();
  }

  async function handleRestore() {
    if (!email.trim()) return;
    setRestoreStatus('loading');
    // Without a backend, we optimistically trust the user that they paid.
    // Replace the setTimeout below with an actual API call once you have a
    // verification endpoint (e.g. a Cloudflare Worker that checks Stripe
    // customer records by email and returns { pro: true/false }).
    await new Promise(r => setTimeout(r, 1200));
    setRestoreStatus('success');
    await storePro(true);
    setTimeout(() => {
      onUnlock();
      onClose();
      setView('main');
      setRestoreStatus('');
      setEmail('');
    }, 800);
  }

  function resetAndClose() {
    setView('main');
    setRestoreStatus('');
    setEmail('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {view === 'main' ? (
            <>
              <Text style={styles.emoji}>⛳</Text>
              <Text style={styles.title}>TeeWager Pro</Text>
              <Text style={styles.price}>$2.99 / month</Text>

              <ScrollView style={styles.featureList} showsVerticalScrollIndicator={false}>
                {PRO_FEATURES.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <Text style={styles.check}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </ScrollView>

              <TouchableOpacity style={styles.buyBtn} onPress={handlePurchase} activeOpacity={0.85}>
                <Text style={styles.buyText}>Unlock Pro — $2.99/mo</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setView('restore')} style={styles.restoreBtn}>
                <Text style={styles.restoreText}>Restore purchase</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={resetAndClose}>
                <Text style={styles.closeText}>Not now</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.emoji}>📧</Text>
              <Text style={styles.title}>Restore Purchase</Text>
              <Text style={styles.restoreSub}>
                Enter the email address you used when you purchased TeeWager Pro.
              </Text>

              <TextInput
                style={styles.emailInput}
                placeholder="you@example.com"
                placeholderTextColor={colors.textLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
                editable={restoreStatus !== 'loading'}
              />

              {restoreStatus === 'loading' ? (
                <ActivityIndicator color={colors.green} style={{ marginVertical: spacing.md }} />
              ) : restoreStatus === 'success' ? (
                <Text style={styles.successText}>✓ Pro unlocked!</Text>
              ) : (
                <TouchableOpacity
                  style={[styles.buyBtn, !email.trim() && styles.buyBtnDisabled]}
                  onPress={handleRestore}
                  disabled={!email.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.buyText}>Restore</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => { setView('main'); setRestoreStatus(''); setEmail(''); }}>
                <Text style={styles.closeText}>← Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card:        { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 44 },
  emoji:       { fontSize: 40, textAlign: 'center', marginBottom: spacing.sm },
  title:       { fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.textDark },
  price:       { fontSize: 16, textAlign: 'center', color: colors.gold, fontWeight: '600', marginBottom: spacing.md },
  featureList: { maxHeight: 200, marginBottom: spacing.md },
  featureRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  check:       { color: colors.green, fontWeight: '800', fontSize: 16, marginRight: spacing.sm },
  featureText: { fontSize: 15, color: colors.textDark, flex: 1 },
  buyBtn:      { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md },
  buyBtnDisabled: { opacity: 0.4 },
  buyText:     { color: colors.white, fontWeight: '800', fontSize: 16 },
  restoreBtn:  { alignItems: 'center', marginBottom: spacing.sm },
  restoreText: { color: colors.textMid, fontSize: 14, textDecorationLine: 'underline' },
  closeText:   { textAlign: 'center', color: colors.textLight, fontSize: 14, marginTop: spacing.xs },
  restoreSub:  { fontSize: 14, color: colors.textMid, textAlign: 'center', marginVertical: spacing.md, lineHeight: 20 },
  emailInput:  { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: 16, color: colors.textDark, marginBottom: spacing.md },
  successText: { fontSize: 18, color: colors.green, fontWeight: '800', textAlign: 'center', marginVertical: spacing.md },
});
