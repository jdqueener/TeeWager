import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../context/GameContext';
import { getEffectiveValue } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';
import PaywallModal from '../components/PaywallModal';

export default function BreakdownScreen() {
  const { state, pro, setPro, activeBeans } = useGame();
  const { players, scores, firstBonus, beanValue } = state;
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [paywallVisible, setPaywallVisible] = useState(false);

  if (!pro) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockEmoji}>🔒</Text>
        <Text style={styles.lockTitle}>Hole-by-Hole Breakdown</Text>
        <Text style={styles.lockSub}>See every achievement, hole by hole. Pro only.</Text>
        <TouchableOpacity style={styles.unlockBtn} onPress={() => setPaywallVisible(true)}>
          <Text style={styles.unlockText}>Unlock Pro</Text>
        </TouchableOpacity>
        <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
      </View>
    );
  }

  const name = players[selectedPlayer];
  const rows = [];
  for (let h = 0; h < 18; h++) {
    const holeScores = scores[selectedPlayer]?.[h] || {};
    const earned = activeBeans.filter(b => (holeScores[b.id] || 0) > 0);
    if (earned.length === 0) continue;
    let holeTotal = 0;
    const details = earned.map(bean => {
      const count = holeScores[bean.id];
      const ev    = getEffectiveValue(bean, selectedPlayer, h, firstBonus);
      const sub   = count * ev;
      holeTotal += sub;
      return { bean, count, ev, sub };
    });
    rows.push({ hole: h + 1, details, holeTotal });
  }

  return (
    <View style={styles.root}>
      {/* Player tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.playerTabs} contentContainerStyle={{ padding: spacing.sm }}>
        {players.map((p, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.tab, selectedPlayer === i && styles.tabActive]}
            onPress={() => setSelectedPlayer(i)}
          >
            <Text style={[styles.tabText, selectedPlayer === i && styles.tabTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.playerHeading}>{name}</Text>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No beans recorded yet.</Text>
        ) : rows.map(row => (
          <View key={row.hole} style={styles.holeCard}>
            <View style={styles.holeHeader}>
              <Text style={styles.holeNum}>Hole {row.hole}</Text>
              <Text style={[styles.holeTotal, row.holeTotal < 0 && styles.neg]}>
                {row.holeTotal >= 0 ? `+${row.holeTotal}` : row.holeTotal} beans
                {' '}(${(row.holeTotal * beanValue).toFixed(2)})
              </Text>
            </View>
            {row.details.map(({ bean, count, ev, sub }) => (
              <View key={bean.id} style={styles.detailRow}>
                <Text style={styles.detailName}>{bean.name} ×{count}</Text>
                <Text style={[styles.detailVal, sub < 0 && styles.neg]}>
                  {sub >= 0 ? `+${sub}` : sub} bean{Math.abs(sub) !== 1 ? 's' : ''}
                </Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },
  lockScreen:    { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  lockEmoji:     { fontSize: 48, marginBottom: spacing.md },
  lockTitle:     { fontSize: 22, fontWeight: '800', color: colors.textDark, textAlign: 'center' },
  lockSub:       { fontSize: 15, color: colors.textMid, textAlign: 'center', marginTop: spacing.sm, marginBottom: spacing.lg },
  unlockBtn:     { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 40 },
  unlockText:    { color: colors.white, fontWeight: '800', fontSize: 16 },
  playerTabs:    { backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border, maxHeight: 56 },
  tab:           { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, marginRight: spacing.xs },
  tabActive:     { backgroundColor: colors.green },
  tabText:       { fontSize: 14, fontWeight: '600', color: colors.textMid },
  tabTextActive: { color: colors.white },
  content:       { padding: spacing.md, paddingBottom: 80 },
  playerHeading: { fontSize: 22, fontWeight: '800', color: colors.textDark, marginBottom: spacing.md },
  empty:         { color: colors.textLight, textAlign: 'center', marginTop: 40, fontSize: 15 },
  holeCard:      { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden' },
  holeHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.offWhite, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  holeNum:       { fontWeight: '700', fontSize: 15, color: colors.textDark },
  holeTotal:     { fontWeight: '700', fontSize: 14, color: colors.green },
  detailRow:     { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, paddingVertical: 8 },
  detailName:    { fontSize: 14, color: colors.textDark },
  detailVal:     { fontSize: 14, fontWeight: '600', color: colors.green },
  neg:           { color: colors.red },
});
