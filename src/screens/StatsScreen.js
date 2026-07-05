import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Platform, Modal, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useGame } from '../context/GameContext';
import { loadStats, saveStats } from '../utils/storage';
import { colors, spacing, radius } from '../utils/theme';
import Avatar from '../components/Avatar';
import PaywallModal from '../components/PaywallModal';
import ProBanner from '../components/ProBanner';

export default function StatsScreen() {
  const { pro, setPro, dispatch } = useGame();
  const [stats, setStats] = useState({});
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);

  // Reload whenever the tab is focused so fresh saves from Settle Up appear
  useFocusEffect(useCallback(() => {
    if (pro) loadStats().then(setStats);
  }, [pro]));

  async function clearStats() {
    await saveStats({});
    setStats({});
    setResetVisible(false);
  }

  function confirmReset() {
    if (Platform.OS === 'web') {
      setResetVisible(true);
    } else {
      Alert.alert('Reset all stats?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: clearStats },
      ]);
    }
  }

  if (!pro) {
    return (
      <View style={styles.root}>
        <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />
        <View style={styles.lockScreen}>
          <Text style={styles.lockEmoji}>🏆</Text>
          <Text style={styles.lockTitle}>Lifetime Stats</Text>
          <Text style={styles.lockSub}>Track beans won across all rounds. The ultimate bragging rights.</Text>
          <TouchableOpacity style={styles.unlockBtn} onPress={() => setPaywallVisible(true)}>
            <Text style={styles.unlockText}>Unlock Pro</Text>
          </TouchableOpacity>
          <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
        </View>
      </View>
    );
  }

  const sorted = Object.entries(stats).sort((a, b) => b[1].totalBeans - a[1].totalBeans);

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headingRow}>
          <Text style={styles.heading}>Lifetime Stats</Text>
          {sorted.length > 0 && (
            <TouchableOpacity onPress={confirmReset}>
              <Text style={styles.resetLink}>Reset</Text>
            </TouchableOpacity>
          )}
        </View>

        {sorted.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.empty}>No stats yet.</Text>
            <Text style={styles.emptySub}>Finish a round and tap "Save to Lifetime Stats" on the Settle Up tab.</Text>
          </View>
        ) : sorted.map(([name, s], rank) => {
          const avg = s.rounds > 0 ? (s.totalBeans / s.rounds).toFixed(1) : '—';
          const winPct = s.rounds > 0 ? Math.round(((s.wins || 0) / s.rounds) * 100) : 0;
          return (
            <View key={name} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.rank}>#{rank + 1}</Text>
                <Avatar name={name} size={42} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{name}</Text>
                  <Text style={styles.subName}>{s.rounds} round{s.rounds !== 1 ? 's' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.totalBeans, s.totalBeans < 0 && styles.neg]}>
                    {s.totalBeans >= 0 ? `+${s.totalBeans}` : s.totalBeans}
                  </Text>
                  <Text style={styles.totalLabel}>total beans</Text>
                </View>
              </View>

              <View style={styles.statRow}>
                <Stat label="Avg / round" value={avg > 0 ? `+${avg}` : avg} positive={parseFloat(avg) > 0} />
                <Stat label="Win rate" value={`${winPct}%`} positive={winPct > 0} />
                <Stat label="Total $" value={s.totalDollars >= 0 ? `+$${s.totalDollars.toFixed(2)}` : `-$${Math.abs(s.totalDollars).toFixed(2)}`} positive={s.totalDollars >= 0} />
              </View>

              {s.bestRound && (
                <Text style={styles.bestDate}>
                  Best: {s.bestRoundBeans >= 0 ? `+${s.bestRoundBeans}` : s.bestRoundBeans} beans on {s.bestRound}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Web reset confirm */}
      <Modal visible={resetVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Reset all stats?</Text>
            <Text style={styles.confirmSub}>This cannot be undone.</Text>
            <TouchableOpacity style={styles.confirmDestructive} onPress={clearStats}>
              <Text style={styles.confirmDestructiveText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmCancel} onPress={() => setResetVisible(false)}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Stat({ label, value, positive }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={[{ fontSize: 16, fontWeight: '800' }, positive ? { color: colors.green } : { color: colors.red }]}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background },
  content:      { padding: spacing.md, paddingBottom: 80 },
  headingRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  heading:      { fontSize: 26, fontWeight: '900', color: colors.textDark },
  resetLink:    { fontSize: 14, color: colors.red, fontWeight: '600' },

  emptyWrap:    { alignItems: 'center', marginTop: 60 },
  emptyEmoji:   { fontSize: 48, marginBottom: spacing.sm },
  empty:        { fontSize: 18, fontWeight: '700', color: colors.textMid },
  emptySub:     { fontSize: 14, color: colors.textLight, textAlign: 'center', marginTop: spacing.sm, maxWidth: 280, lineHeight: 20 },

  card:         { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden' },
  cardHeader:   { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  rank:         { fontSize: 18, fontWeight: '900', color: colors.textLight, width: 28 },
  name:         { fontSize: 16, fontWeight: '700', color: colors.textDark },
  subName:      { fontSize: 12, color: colors.textLight, marginTop: 1 },
  totalBeans:   { fontSize: 22, fontWeight: '900', color: colors.green },
  totalLabel:   { fontSize: 10, color: colors.textLight },
  neg:          { color: colors.red },
  statRow:      { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  bestDate:     { fontSize: 12, color: colors.textLight, textAlign: 'center', paddingBottom: spacing.sm },

  lockScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, marginTop: -40 },
  lockEmoji:    { fontSize: 48, marginBottom: spacing.md },
  lockTitle:    { fontSize: 22, fontWeight: '800', color: colors.textDark, textAlign: 'center' },
  lockSub:      { fontSize: 15, color: colors.textMid, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  unlockBtn:    { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 40 },
  unlockText:   { color: colors.white, fontWeight: '800', fontSize: 16 },

  confirmOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  confirmCard:            { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, width: '100%', maxWidth: 340 },
  confirmTitle:           { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: spacing.xs },
  confirmSub:             { fontSize: 14, color: colors.textMid, marginBottom: spacing.lg },
  confirmDestructive:     { backgroundColor: colors.red, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  confirmDestructiveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  confirmCancel:          { paddingVertical: 12, alignItems: 'center' },
  confirmCancelText:      { color: colors.textMid, fontSize: 15 },
});
