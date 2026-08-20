import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, radius } from '../utils/theme';
import { setPro as storePro } from '../utils/storage';
import { grantPro } from '../utils/pro';
import { supabase } from '../utils/supabase';

// Web-only Stripe links (live — replace test links when ready)
const STRIPE_MONTHLY  = 'https://buy.stripe.com/6oU14g4dV94G8mNeu63AY00';
const STRIPE_ANNUAL   = 'https://buy.stripe.com/8x24gsh0H4OqbyZbhU3AY01';
const STRIPE_LIFETIME = 'https://buy.stripe.com/5kQ00cbGn6WyeLb1Hk3AY02';

// RevenueCat product IDs
const PRODUCT_MONTHLY  = 'io.teewager.app.pro.monthly';
const PRODUCT_ANNUAL   = 'io.teewager.app.pro.annual';
const PRODUCT_LIFETIME = 'io.teewager.app.pro.lifetime';

const PRO_FEATURES = [
  'Full scorecard with real yardages — ditch the paper',
  'All 13 games unlocked — birdie, sandy, HIO & more',
  'Up to 5 players',
  'Hole-by-hole breakdown tab',
  'Screenshot share card for the group chat',
  'Lifetime stats tracker',
];

async function nativePurchase(productId, onUnlock, onClose, setLoading) {
  try {
    setLoading(productId);
    const Purchases = (await import('react-native-purchases')).default;
    const offerings = await Purchases.getOfferings();
    const all = offerings.current?.availablePackages ?? [];
    const pkg = all.find(p => p.product.identifier === productId);
    if (!pkg) throw new Error('Product not found');
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    if (customerInfo.entitlements.active['pro']) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await grantPro(session.user.id);
      await storePro(true);
      onUnlock();
      onClose();
    }
  } catch (e) {
    if (!e.userCancelled) console.warn('Purchase error', e);
  } finally {
    setLoading(null);
  }
}

async function nativeRestore(onUnlock, onClose, setRestoreStatus) {
  try {
    setRestoreStatus('loading');
    const Purchases = (await import('react-native-purchases')).default;
    const customerInfo = await Purchases.restorePurchases();
    if (customerInfo.entitlements.active['pro']) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await grantPro(session.user.id);
      await storePro(true);
      setRestoreStatus('success');
      setTimeout(() => { onUnlock(); onClose(); setRestoreStatus(''); }, 800);
    } else {
      setRestoreStatus('none');
      setTimeout(() => setRestoreStatus(''), 2000);
    }
  } catch (e) {
    console.warn('Restore error', e);
    setRestoreStatus('');
  }
}

export default function PaywallModal({ visible, onClose, onUnlock }) {
  const [view, setView] = useState('main');
  const [loading, setLoading] = useState(null);
  const [restoreStatus, setRestoreStatus] = useState('');

  async function handlePurchase(productId, stripeUrl) {
    if (Platform.OS === 'web') {
      window.location.href = stripeUrl;
      return;
    }
    await nativePurchase(productId, onUnlock, onClose, setLoading);
  }

  async function handleRestore() {
    if (Platform.OS === 'web') return;
    await nativeRestore(onUnlock, onClose, setRestoreStatus);
  }

  function resetAndClose() {
    setView('main'); setRestoreStatus(''); onClose();
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
              <TouchableOpacity
                style={styles.tierCard}
                onPress={() => handlePurchase(PRODUCT_MONTHLY, STRIPE_MONTHLY)}
                activeOpacity={0.85}
                disabled={!!loading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>Monthly</Text>
                  <Text style={styles.tierSub}>Try it, cancel anytime</Text>
                </View>
                {loading === PRODUCT_MONTHLY
                  ? <ActivityIndicator color={colors.green} />
                  : <Text style={styles.tierPrice}>$4.99<Text style={styles.tierPer}>/mo</Text></Text>}
              </TouchableOpacity>

              {/* Annual — featured */}
              <TouchableOpacity
                style={[styles.tierCard, styles.tierCardFeatured]}
                onPress={() => handlePurchase(PRODUCT_ANNUAL, STRIPE_ANNUAL)}
                activeOpacity={0.85}
                disabled={!!loading}
              >
                <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>BEST VALUE</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.tierName, { color: colors.white }]}>Annual</Text>
                  <Text style={[styles.tierSub, { color: 'rgba(255,255,255,0.65)' }]}>2 months free vs monthly</Text>
                </View>
                {loading === PRODUCT_ANNUAL
                  ? <ActivityIndicator color={colors.white} />
                  : <Text style={[styles.tierPrice, { color: colors.white }]}>$49.90<Text style={styles.tierPer}>/yr</Text></Text>}
              </TouchableOpacity>

              {/* Lifetime */}
              <TouchableOpacity
                style={styles.tierCard}
                onPress={() => handlePurchase(PRODUCT_LIFETIME, STRIPE_LIFETIME)}
                activeOpacity={0.85}
                disabled={!!loading}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.tierName}>Lifetime</Text>
                  <Text style={styles.tierSub}>Pay once, play forever</Text>
                </View>
                {loading === PRODUCT_LIFETIME
                  ? <ActivityIndicator color={colors.green} />
                  : <Text style={styles.tierPrice}>$79.99<Text style={styles.tierPer}> once</Text></Text>}
              </TouchableOpacity>

              {Platform.OS !== 'web' && (
                <TouchableOpacity onPress={handleRestore} style={styles.restoreBtn} disabled={!!loading}>
                  {restoreStatus === 'loading'
                    ? <ActivityIndicator color={colors.textMid} />
                    : restoreStatus === 'success'
                    ? <Text style={styles.successText}>✓ Pro restored!</Text>
                    : restoreStatus === 'none'
                    ? <Text style={styles.restoreText}>No purchase found</Text>
                    : <Text style={styles.restoreText}>Restore purchase</Text>}
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.skipBtn} onPress={resetAndClose}>
                <Text style={styles.skipText}>Not now</Text>
              </TouchableOpacity>
            </>
          ) : null}
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

  restoreBtn:   { alignItems: 'center' },
  restoreText:  { color: colors.textMid, fontSize: 14, textDecorationLine: 'underline' },
  successText:  { fontSize: 15, color: colors.green, fontWeight: '800' },
  skipBtn:      { alignItems: 'center', paddingVertical: spacing.xs },
  skipText:     { color: colors.textLight, fontSize: 14 },
});
