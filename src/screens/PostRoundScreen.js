import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { colors, spacing, radius } from '../utils/theme';

const STRIPE_MONTHLY  = 'https://buy.stripe.com/REPLACE_MONTHLY';
const STRIPE_ANNUAL   = 'https://buy.stripe.com/REPLACE_ANNUAL';
const STRIPE_LIFETIME = 'https://buy.stripe.com/REPLACE_LIFETIME';

const PRO_FEATURES = [
  'All 13 beans — HIO, sandy, 2-tree, flag-length & more',
  'Up to 5 players',
  'Hole-by-hole breakdown tab',
  'Screenshot share card for the group chat',
  'Lifetime stats tracker',
  'Custom bean creator',
];

function openStripe(url) {
  if (Platform.OS === 'web') window.location.href = url;
}

// ── Winner card ───────────────────────────────────────────────────────────────
function WinnerCard({ summary }) {
  if (!summary) return null;
  const { winner, players, beanValue } = summary;
  const dollars = (winner.beans * beanValue).toFixed(2);
  return (
    <View style={styles.winnerCard}>
      <Text style={styles.winnerLabel}>Round winner</Text>
      <Text style={styles.winnerName}>{winner.name}</Text>
      <Text style={styles.winnerBeans}>{winner.beans} beans · +${dollars}</Text>
      {players.length > 1 && (
        <View style={styles.winnerOthers}>
          {players.filter(p => p.name !== winner.name).map(p => (
            <Text key={p.name} style={styles.winnerOtherText}>
              {p.name}  {p.beans >= 0 ? '+' : ''}{p.beans}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// ── Nudge view — shown after round 1 ─────────────────────────────────────────
function NudgeView({ summary, onAcceptTrial, onSkip }) {
  return (
    <View style={styles.sheet}>
      <View style={styles.pill} />

      <WinnerCard summary={summary} />

      <Text style={styles.title}>Your next round is on us.</Text>
      <Text style={styles.body}>
        Try TeeWager Pro free — all 13 beans, breakdown tab, share card. No credit card needed.
      </Text>

      <View style={styles.featureList}>
        {PRO_FEATURES.map(f => (
          <View key={f} style={styles.featureRow}>
            <View style={styles.checkCircle}><Text style={styles.checkMark}>✓</Text></View>
            <Text style={styles.featureText}>{f}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.primaryBtn} onPress={onAcceptTrial} activeOpacity={0.85}>
        <Text style={styles.primaryBtnText}>Unlock my free Pro round →</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>No thanks — stay on free</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Paywall view — shown after trial round ────────────────────────────────────
function PaywallView({ onSkip }) {
  return (
    <View style={styles.sheet}>
      <View style={styles.pill} />

      <Text style={styles.emoji}>⛳</Text>
      <Text style={styles.title}>Keep the full experience.</Text>
      <Text style={styles.body}>
        Your free Pro round is up. Upgrade to keep all 13 beans, breakdown tab, share cards, and more.
      </Text>

      {/* Monthly */}
      <TouchableOpacity style={styles.tierCard} onPress={() => openStripe(STRIPE_MONTHLY)} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tierName}>Monthly</Text>
          <Text style={styles.tierSub}>Try it, cancel anytime</Text>
        </View>
        <Text style={styles.tierPrice}>$2.99<Text style={styles.tierPer}>/mo</Text></Text>
      </TouchableOpacity>

      {/* Annual — featured */}
      <TouchableOpacity style={[styles.tierCard, styles.tierCardFeatured]} onPress={() => openStripe(STRIPE_ANNUAL)} activeOpacity={0.85}>
        <View style={styles.featuredBadge}><Text style={styles.featuredBadgeText}>BEST VALUE</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.tierName, styles.tierNameLight]}>Annual</Text>
          <Text style={[styles.tierSub, styles.tierSubLight]}>2 months free vs monthly</Text>
        </View>
        <Text style={[styles.tierPrice, styles.tierPriceLight]}>$29.90<Text style={styles.tierPer}>/yr</Text></Text>
      </TouchableOpacity>

      {/* Lifetime */}
      <TouchableOpacity style={styles.tierCard} onPress={() => openStripe(STRIPE_LIFETIME)} activeOpacity={0.85}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tierName}>Lifetime</Text>
          <Text style={styles.tierSub}>Pay once, play forever</Text>
        </View>
        <Text style={styles.tierPrice}>$49.99<Text style={styles.tierPer}> once</Text></Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.skipBtn} onPress={onSkip}>
        <Text style={styles.skipText}>Not now — continue free</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function PostRoundScreen({ visible, view, summary, onAcceptTrial, onSkip }) {
  if (!visible) return null;
  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onSkip} />
      {view === 'nudge'
        ? <NudgeView summary={summary} onAcceptTrial={onAcceptTrial} onSkip={onSkip} />
        : <PaywallView onSkip={onSkip} />
      }
    </View>
  );
}

const styles = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end', zIndex: 999 },
  sheet:      { backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 48, gap: spacing.sm },
  pill:       { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.xs },

  // Winner card
  winnerCard:       { backgroundColor: colors.green, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs },
  winnerLabel:      { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  winnerName:       { fontSize: 22, fontWeight: '900', color: colors.white, marginBottom: 2 },
  winnerBeans:      { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  winnerOthers:     { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs },
  winnerOtherText:  { fontSize: 13, color: 'rgba(255,255,255,0.55)' },

  emoji:      { fontSize: 36, textAlign: 'center' },
  title:      { fontSize: 22, fontWeight: '900', color: colors.textDark, textAlign: 'center' },
  body:       { fontSize: 14, color: colors.textMid, textAlign: 'center', lineHeight: 21 },

  // Feature list
  featureList:  { gap: 6 },
  featureRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkCircle:  { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  checkMark:    { fontSize: 11, color: colors.white, fontWeight: '900' },
  featureText:  { fontSize: 14, color: colors.textDark, flex: 1, lineHeight: 20 },

  primaryBtn:      { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText:  { color: colors.white, fontWeight: '800', fontSize: 16 },

  skipBtn:    { alignItems: 'center', paddingVertical: spacing.xs },
  skipText:   { color: colors.textLight, fontSize: 14 },

  // Tier cards
  tierCard:         { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, position: 'relative', overflow: 'hidden' },
  tierCardFeatured: { backgroundColor: colors.green, borderColor: colors.green },
  tierName:         { fontSize: 15, fontWeight: '800', color: colors.textDark },
  tierNameLight:    { color: colors.white },
  tierSub:          { fontSize: 12, color: colors.textLight, marginTop: 2 },
  tierSubLight:     { color: 'rgba(255,255,255,0.65)' },
  tierPrice:        { fontSize: 20, fontWeight: '900', color: colors.textDark },
  tierPriceLight:   { color: colors.white },
  tierPer:          { fontSize: 12, fontWeight: '400' },
  featuredBadge:    { position: 'absolute', top: 0, right: 0, backgroundColor: colors.gold, paddingHorizontal: 10, paddingVertical: 3, borderBottomLeftRadius: radius.sm },
  featuredBadgeText:{ fontSize: 9, fontWeight: '800', color: colors.white, letterSpacing: 0.5 },
});
