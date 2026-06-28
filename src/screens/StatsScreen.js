import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../context/GameContext';
import { loadStats } from '../utils/storage';
import { colors, spacing, radius } from '../utils/theme';
import Avatar from '../components/Avatar';
import PaywallModal from '../components/PaywallModal';

export default function StatsScreen() {
  const { pro, setPro } = useGame();
  const [stats, setStats] = useState({});
  const [paywallVisible, setPaywallVisible] = useState(false);

  useEffect(() => {
    if (pro) loadStats().then(setStats);
  }, [pro]);

  if (!pro) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockEmoji}>🏆</Text>
        <Text style={styles.lockTitle}>Lifetime Stats</Text>
        <Text style={styles.lockSub}>Track beans won across all rounds. The ultimate bragging rights.</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={() => setPaywallVisible(true)}>
          <Text style={styles.unlockText}>Unlock Pro</Text>
        </TouchableOpacity>
        <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
      </View>
    );
  }

  const sorted = Object.entries(stats).sort((a, b) => b[1].totalBeans - a[1].totalBeans);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Lifetime Stats</Text>
        {sorted.length === 0 ? (
          <Text style={styles.empty}>No stats yet. Finish a round and tap "Save to Lifetime Stats."</Text>
        ) : sorted.map(([name, s], rank) => (
          <View key={name} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.rank}>#{rank + 1}</Text>
              <Avatar name={name} size={42} />
              <Text style={styles.name}>{name}</Text>
              <Text style={[styles.totalBeans, s.totalBeans < 0 && styles.neg]}>
                {s.totalBeans >= 0 ? `+${s.totalBeans}` : s.totalBeans}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Stat label="Rounds" value={s.rounds} />
              <Stat label="Total $" value={`$${s.totalDollars.toFixed(2)}`} />
              <Stat label="Best Round" value={`${s.bestRoundBeans} beans`} />
            </View>
            {s.bestRound && <Text style={styles.bestDate}>Best round: {s.bestRound}</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textDark }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.textLight, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.background },
  lockScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  lockEmoji:  { fontSize: 48, marginBottom: spacing.md },
  lockTitle:  { fontSize: 22, fontWeight: '800', color: colors.textDark, textAlign: 'center' },
  lockSub:    { fontSize: 15, color: colors.textMid, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  unlockBtn:  { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 40 },
  unlockText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  content:    { padding: spacing.md, paddingBottom: 80 },
  heading:    { fontSize: 26, fontWeight: '900', color: colors.textDark, marginBottom: spacing.md },
  empty:      { color: colors.textLight, textAlign: 'center', marginTop: 40, fontSize: 15, lineHeight: 22 },
  card:       { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm },
  rank:       { fontSize: 18, fontWeight: '900', color: colors.textLight, width: 28 },
  name:       { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textDark },
  totalBeans: { fontSize: 22, fontWeight: '900', color: colors.green },
  neg:        { color: colors.red },
  statRow:    { flexDirection: 'row', borderTopWidth: 0.5, borderTopColor: colors.border, padding: spacing.md },
  bestDate:   { fontSize: 12, color: colors.textLight, textAlign: 'center', paddingBottom: spacing.sm },
});
