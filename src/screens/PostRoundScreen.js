import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform,
} from 'react-native';
import { colors, spacing, radius } from '../utils/theme';

// Stripe Payment Links — replace these once live in the Stripe Dashboard
const STRIPE_MONTHLY  = 'https://buy.stripe.com/REPLACE_MONTHLY';
const STRIPE_ANNUAL   = 'https://buy.stripe.com/REPLACE_ANNUAL';
const STRIPE_LIFETIME = 'https://buy.stripe.com/REPLACE_LIFETIME';

const PRO_FEATURES = [
  'All 13 beans unlocked',
  'Up to 5 players',
  'Low Ball / Skins bean',
  'Hole-by-hole Breakdown tab',
  'Lifetime Stats tracker',
  'Share card for group chat',
];

function openStripe(url) {
  if (Platform.OS === 'web') {
    window.location.href = url;
  }
  // Native: wire Linking / WebBrowser here when going live
}

// ── Nudge view — shown after round 1 ─────────────────────────────────────────
function NudgeView({ onAcceptTrial, onSkip }) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>🎉</Text>
      <Text style={styles.title}>Great first round!</Text>
      <Text style={styles.body}>
        Your next round is on us. Try TeeWager Pro free — all 13 beans, Breakdown tab,
        everything unlocked. No credit card needed.
      </Text>

      <View style={styles.featureList}>
        {PRO_FEATURES.map(f => (
          <View key={f} style={styles.featureRow}>
            <Text style={styles.check}>✓</Text>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onAcceptTrial} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Unlock my free Pro round</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>Skip — stay on free tier</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Paywall view — shown after trial round ────────────────────────────────────
function PaywallView({ onSkip }) {
  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>⛳</Text>
      <Text style={styles.title}>Upgrade to Pro</Text>
      <Text style={styles.body}>
        Your free Pro round is over. Upgrade to keep all the beans, the Breakdown tab, and more.
      </Text>

      <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.tierCard} onPress={() => openStripe(STRIPE_MONTHLY)} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tierName}>Monthly</Text>
            <Text style={styles.tierSub}>Try it, cancel anytime</Text>
          </View>
          <Text style={styles.tierPrice}>$2.99<Text style={styles.tierPer}>/mo</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tierCard, styles.tierCardBest]} onPress={() => openStripe(STRIPE_ANNUAL)} activeOpacity={0.85}>
          <View style={styles.bestBadge}><Text style={styles.bestBadgeText}>BEST VALUE</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.tierName, { color: colors.white }]}>Annual</Text>
            <Text style={[styles.tierSub, { color: 'rgba(255,255,255,0.75)' }]}>2 months free vs monthly</Text>
          </View>
          <Text style={[styles.tierPrice, { color: colors.white }]}>$29.90<Text style={styles.tierPer}>/yr</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tierCard} onPress={() => openStripe(STRIPE_LIFETIME)} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tierName}>Lifetime</Text>
            <Text style={styles.tierSub}>Pay once, play forever</Text>
          </View>
          <Text style={styles.tierPrice}>$49.99<Text style={styles.tierPer}> once</Text></Text>
        </TouchableOpacity>

        <View style={styles.featureList}>
          {PRO_FEATURES.map(f => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.check}>✓</Text>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>Not now — continue free</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PostRoundScreen({ visible, view, onAcceptTrial, onSkip }) {
  // view: 'nudge' | 'paywall'
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onSkip}>
      <View style={styles.overlay}>
        {view === 'nudge'
          ? <NudgeView onAcceptTrial={onAcceptTrial} onSkip={onSkip} />
          : <PaywallView onSkip={onSkip} />
        }
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card:         { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 44 },

  emoji:        { fontSize: 40, textAlign: 'center', marginBottom: spacing.sm },
  title:        { fontSize: 24, fontWeight: '900', textAlign: 'center', color: colors.textDark, marginBottom: spacing.sm },
  body:         { fontSize: 15, color: colors.textMid, textAlign: 'center', lineHeight: 22, marginBottom: spacing.md },

  featureList:  { marginBottom: spacing.md },
  featureRow:   { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  check:        { color: colors.green, fontWeight: '800', fontSize: 16, marginRight: spacing.sm, width: 20 },
  featureText:  { fontSize: 15, color: colors.textDark, flex: 1 },

  primaryBtn:   { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', marginBottom: spacing.sm },
  primaryBtnText: { color: colors.white, fontWeight: '800', fontSize: 16 },

  skipBtn:      { alignItems: 'center', paddingVertical: spacing.sm },
  skipText:     { color: colors.textLight, fontSize: 14, textDecorationLine: 'underline' },

  tierCard:     { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, position: 'relative', overflow: 'hidden' },
  tierCardBest: { backgroundColor: colors.green, borderColor: colors.green },
  tierName:     { fontSize: 16, fontWeight: '800', color: colors.textDark },
  tierSub:      { fontSize: 12, color: colors.textLight, marginTop: 2 },
  tierPrice:    { fontSize: 22, fontWeight: '900', color: colors.textDark },
  tierPer:      { fontSize: 13, fontWeight: '400' },
  bestBadge:    { position: 'absolute', top: 0, right: 0, backgroundColor: colors.gold, paddingHorizontal: spacing.sm, paddingVertical: 2, borderBottomLeftRadius: radius.sm },
  bestBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
});
