import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';
import { totalBeansForPlayer } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';
import Avatar from '../components/Avatar';
import ProBanner from '../components/ProBanner';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { state, dispatch, pro, setPro, activeBeans } = useGame();
  const { players, scores, firstBonus, beanValue } = state;

  const n = players.length;
  const rawBeans = players.map((_, i) => totalBeansForPlayer(i, scores, activeBeans, firstBonus));
  const totalBeans = rawBeans.reduce((s, v) => s + v, 0);
  // Net beans = zero-sum across all players
  const netBeans = rawBeans.map(b => b * n - totalBeans);
  const ranked = players
    .map((name, i) => ({ name, i, netBeans: netBeans[i] }))
    .sort((a, b) => b.netBeans - a.netBeans);

  const pot = ranked.reduce((s, p) => s + Math.max(p.netBeans * beanValue, 0), 0);
  const firstNetBeans = ranked[0]?.netBeans ?? 0;

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => {}} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.potCard}>
          <Text style={styles.potLabel}>Total Bean Pot</Text>
          <Text style={styles.potValue}>${pot.toFixed(2)}</Text>
          <Text style={styles.potSub}>${beanValue.toFixed(2)} per bean</Text>
        </View>

        {ranked.map((p, rank) => {
          const isFirst = p.netBeans === firstNetBeans && firstNetBeans > 0;
          return (
            <View key={p.i} style={[styles.row, isFirst && styles.rowFirst]}>
              <Text style={styles.medal}>{MEDALS[rank] || `${rank + 1}.`}</Text>
              <Avatar name={p.name} size={40} />
              <Text style={styles.name}>{p.name}</Text>
              <View style={styles.right}>
                <Text style={[styles.beans, p.netBeans < 0 && styles.neg]}>
                  {p.netBeans >= 0 ? `+${p.netBeans}` : p.netBeans} beans
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.background },
  content:  { padding: spacing.md, paddingBottom: 100 },

  potCard:  { backgroundColor: colors.green, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md, shadowColor: colors.green, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  potLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  potValue: { color: colors.white, fontSize: 48, fontWeight: '900', marginTop: 4, letterSpacing: -1 },
  potSub:   { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },

  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  rowFirst: { borderColor: colors.gold, borderWidth: 2, shadowColor: colors.gold, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  rowLast:  { opacity: 0.85 },

  medal:   { fontSize: 24, width: 34, textAlign: 'center' },
  name:    { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textDark },
  right:   { alignItems: 'flex-end' },
  beans:   { fontSize: 16, fontWeight: '800', color: colors.green },
  dollars: { fontSize: 13, fontWeight: '600', color: colors.textMid, marginTop: 1 },
  neg:     { color: colors.red },
});
