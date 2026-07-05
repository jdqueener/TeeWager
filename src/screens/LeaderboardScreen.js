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

  const ranked = players
    .map((name, i) => ({ name, i, beans: totalBeansForPlayer(i, scores, activeBeans, firstBonus) }))
    .sort((a, b) => b.beans - a.beans);

  const pot = ranked.reduce((s, p) => s + Math.max(p.beans, 0), 0) * beanValue;

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
          const dollars = p.beans * beanValue;
          return (
            <View key={p.i} style={[styles.row, rank === 0 && styles.rowFirst]}>
              <Text style={styles.medal}>{MEDALS[rank] || `${rank + 1}.`}</Text>
              <Avatar name={p.name} size={40} />
              <Text style={styles.name}>{p.name}</Text>
              <View style={styles.right}>
                <Text style={[styles.beans, p.beans < 0 && styles.neg]}>
                  {p.beans >= 0 ? `+${p.beans}` : p.beans} beans
                </Text>
                <Text style={[styles.dollars, dollars < 0 && styles.neg]}>
                  {dollars >= 0 ? `+$${dollars.toFixed(2)}` : `-$${Math.abs(dollars).toFixed(2)}`}
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
  content:  { padding: spacing.md, paddingBottom: 80 },
  potCard:  { backgroundColor: colors.green, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  potLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  potValue: { color: colors.white, fontSize: 40, fontWeight: '900', marginTop: 4 },
  potSub:   { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 4 },
  row:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm },
  rowFirst: { borderColor: colors.gold, borderWidth: 2 },
  medal:    { fontSize: 22, width: 32, textAlign: 'center' },
  name:     { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textDark },
  right:    { alignItems: 'flex-end' },
  beans:    { fontSize: 15, fontWeight: '700', color: colors.green },
  dollars:  { fontSize: 13, color: colors.textMid },
  neg:      { color: colors.red },
});
