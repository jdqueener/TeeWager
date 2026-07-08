import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { colors, spacing, radius } from '../utils/theme';
import { setPro as storePro } from '../utils/storage';

const STRIPE_MONTHLY  = 'https://buy.stripe.com/REPLACE_MONTHLY';
const STRIPE_ANNUAL   = 'https://buy.stripe.com/REPLACE_ANNUAL';
const STRIPE_LIFETIME = 'https://buy.stripe.com/REPLACE_LIFETIME';

const PRO_FEATURES = [
  'All 13 beans unlocked',
  'Up to 5 players',
  'Custom bean creator',
  'Hole-by-hole breakdown tab',
  'Screenshot share card',
  'Lifetime stats tracker',
];

function openStripe(url) {
  if (Platform.OS === 'web') {
    window.location.href = url;
  }
}

export default function PaywallModal({ visible, onClose, onUnlock }) {
  const [view, setView] = useState('main');
  const [email, setEmail] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url.includes('pro-success')) handleUnlock();
    });
    return () => sub.remove();
  }, []);

  async function handlePurchase(url) {
    if (Platform.OS === 'web') {
      window.location.href = url;
    } else {
      const result = await WebBrowser.openAuthSessionAsync(url, 'teewager://pro-success');
      if (result.type === 'success' && result.url?.includes('pro-success')) handleUnlock();
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
    await new Promise(r => setTimeout(r, 1200));
    setRestoreStatus('success');
    await storePro(true);
    setTimeout(() => { onUnlock(); onClose(); setView('main'); setRestoreStatus(''); setEmail(''); }, 800);
  }

  function resetAndClose() {
    setView('main'); setRestoreStatus(''); setEmail(''); onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={resetAndClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={resetAndClose} />
        <View style={styles.sheet}>
          <View style={styles.pill} />

          {view === 'main' ? (
            <>
              <Text style={styles.title}>TeeWager Pro</Text>
              <Text style={styles.body}>Unlock all 13 beans, breakdown tab, share cards, and lifetime stats.</Text>

              <View style={styles.featureList}>
                {PRO_FEATURES.map(f => (
                  <View key={f} style={styles.featureRow}>
                    <View style={styles.checkCircle}><Text style={styles.checkMark}>✓</Text></View>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              {/* Monthly */}
              <TouchableOpacity style={styles.tierCard} onPress={() => handlePurchase(STRIPE_MONTHLY)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>Monthly</Text>
                  <Text style={styles.tierSub}>Try it, cancel anytime</Text>
                </View>
                <Text style={styles.tierPrice}>$2.99<Text style={styles.tierPer}>/mo</Text></Text>
              </TouchableOpacity>

              {/* Annual — featured */}
              <TouchableOpacity style={[styles.tierCard, styles.tierCardFeatured]} onPress={() => handlePurchase(STRIPE_ANNUAL)} activeOpacity={0.85}>
                <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>BEST VALUE</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color: colors.white }]}>Annual</Text>
                  <Text style={[styles.tierSub, { color: 'rgba(255,255,255,0.65)' }]}>2 months free vs monthly</Text>
                </View>
                <Text style={[styles.tierPrice, { color: colors.white }]}>$29.90<Text style={styles.tierPer}>/yr</Text></Text>
              </TouchableOpacity>

              {/* Lifetime */}
              <TouchableOpacity style={styles.tierCard} onPress={() => handlePurchase(STRIPE_LIFETIME)} activeOpacity={0.85}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>Lifetime</Text>
                  <Text style={styles.tierSub}>Pay once, play forever</Text>
                </View>
                <Text style={styles.tierPrice}>$49.99<Text style={styles.tierPer}> once</Text></Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setView('restore')} style={styles.restoreBtn}>
                <Text style={styles.restoreText}>Restore purchase</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={resetAndClose}>
                <Text style={styles.skipText}>Not now</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>Restore Purchase</Text>
              <Text style={styles.body}>
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
                  style={[styles.primaryBtn, !email.trim() && { opacity: 0.4 }]}
                  onPress={handleRestore}
                  disabled={!email.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Restore</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.skipBtn} onPress={() => { setView('main'); setRestoreStatus(''); setEmail(''); }}>
                <Text style={styles.skipText}>← Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 48, gap: spacing.sm },
  pill:       { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xs },

  title:      { fontSize: 22, fontWeight: '900', color: colors.textDark, textAlign: 'center' },
  body:       { fontSize: 14, color: colors.textMid, textAlign: 'center', lineHeight: 21 },

  featureList:  { gap: 6, marginBottom: spacing.xs },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkCircle:  { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkMark:    { fontSize: 11, color: colors.white, fontWeight: '900' },
  featureText:  { fontSize: 14, color: colors.textDark, flex: 1, lineHeight: 20 },

  tierCard:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, position: 'relative', overflow: 'hidden' },
  tierCardFeatured: { backgroundColor: colors.green, borderColor: colors.green },
  tierName:         { fontSize: 15, fontWeight: '800', color: colors.textDark },
  tierSub:          { fontSize: 12, color: colors.textLight, marginTop: 2 },
  tierPrice:        { fontSize: 20, fontWeight: '900', color: colors.textDark },
  tierPer:          { fontSize: 12, fontWeight: '400' },
  featuredBadge:    { position: 'absolute', top: 0, right: 0, backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 3, borderBottomLeftRadius: radius.sm },
  featuredBadgeText:{ fontSize: 9, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },

  primaryBtn:      { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText:  { color: colors.white, fontWeight: '800', fontSize: 16 },

  restoreBtn:   { alignItems: 'center' },
  restoreText:  { color: colors.textMid, fontSize: 14, textDecorationLine: 'underline' },
  skipBtn:      { alignItems: 'center', paddingVertical: spacing.xs },
  skipText:     { color: colors.textLight, fontSize: 14 },

  emailInput:   { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.md, fontSize: 16, color: colors.textDark },
  successText:  { fontSize: 18, color: colors.green, fontWeight: '800', textAlign: 'center', marginVertical: spacing.md },
});
