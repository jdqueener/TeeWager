import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';
import { totalBeansForPlayer } from '../utils/beans';
import { legStandings, netNassauTeamFormat } from '../utils/nassau';
import { colors, spacing, radius } from '../utils/theme';
import Avatar from '../components/Avatar';
import ProBanner from '../components/ProBanner';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function LeaderboardScreen() {
  const { state, dispatch, pro, setPro, activeBeans } = useGame();
  const { players, scores, firstBonus, beanValue, gameMode = 'beans', nassauStake = 5.00, strokes = [], holeCount = 18,
    nassauPresses = { front: [], back: [], total: [] }, nassauTeams = null, nassauTeamFormat = 'match-play', beansTeams = null } = state;
  const isNassau = gameMode === 'nassau';
  const isTeams = isNassau && !!nassauTeams;
  const isBeansTeams = !isNassau && beansTeams?.length === 2;

  const n = players.length;
  const playerIdxs = players.map((_, i) => i);

  // Beans leaderboard
  let rankedBeans, pot, firstNetBeans;
  if (isBeansTeams) {
    // 2v2 beans scramble — beans only ever land on a team's representative, so rank
    // the 2 teams (combined bean count) rather than showing 2 empty player rows.
    const teamRaw = beansTeams.map(team => team.reduce((s, pi) => s + totalBeansForPlayer(pi, scores, activeBeans, firstBonus), 0));
    const totalRaw = teamRaw.reduce((a, b) => a + b, 0);
    rankedBeans = beansTeams
      .map((team, ti) => ({ name: team.map(pi => players[pi]?.split(' ')[0]).join(' & '), i: team[0], netBeans: teamRaw[ti] * 2 - totalRaw }))
      .sort((a, b) => b.netBeans - a.netBeans);
    pot = rankedBeans.reduce((s, p) => s + Math.max(p.netBeans * beanValue, 0), 0);
    firstNetBeans = rankedBeans[0]?.netBeans ?? 0;
  } else {
    const rawBeans = players.map((_, i) => totalBeansForPlayer(i, scores, activeBeans, firstBonus));
    const totalBeans = rawBeans.reduce((s, v) => s + v, 0);
    const netBeans = rawBeans.map(b => b * n - totalBeans);
    rankedBeans = players
      .map((name, i) => ({ name, i, netBeans: netBeans[i] }))
      .sort((a, b) => b.netBeans - a.netBeans);
    pot = rankedBeans.reduce((s, p) => s + Math.max(p.netBeans * beanValue, 0), 0);
    firstNetBeans = rankedBeans[0]?.netBeans ?? 0;
  }

  // Nassau leaderboard — rank by total wins across all legs
  const frontRange = Array.from({ length: Math.min(9, holeCount) }, (_, i) => i);
  const backRange  = holeCount >= 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [];
  const totalRange = Array.from({ length: holeCount }, (_, i) => i);
  const nassauLegsRanges = holeCount >= 18 ? [frontRange, backRange, totalRange] : [frontRange];

  let rankedNassau, nassauPot, firstNassauNet;
  if (isTeams) {
    // 2v2 team Nassau — rank the 2 teams, not individual players.
    const net = netNassauTeamFormat(players, nassauTeams, strokes, nassauStake, holeCount, nassauPresses, nassauTeamFormat);
    // Show each team's combined take (both members' shares together), not one member's half.
    rankedNassau = nassauTeams
      .map(team => ({ name: team.map(pi => players[pi]?.split(' ')[0]).join(' & '), i: team[0], net: net[team[0]] * team.length }))
      .sort((a, b) => b.net - a.net);
    nassauPot = rankedNassau.reduce((s, p) => s + Math.max(p.net, 0), 0);
    firstNassauNet = rankedNassau[0]?.net ?? 0;
  } else {
    // Aggregate leg wins per player (each won leg = +nassauStake net)
    const nassauNet = new Array(n).fill(0);
    for (const range of nassauLegsRanges) {
      if (n === 2) {
        const { wins } = legStandings(strokes, playerIdxs, range);
        const diff = wins[0] - wins[1];
        if (diff > 0) { nassauNet[0] += nassauStake; nassauNet[1] -= nassauStake; }
        else if (diff < 0) { nassauNet[1] += nassauStake; nassauNet[0] -= nassauStake; }
      } else {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const { wins } = legStandings(strokes, [i, j], range);
            const diff = wins[i] - wins[j];
            if (diff > 0) { nassauNet[i] += nassauStake; nassauNet[j] -= nassauStake; }
            else if (diff < 0) { nassauNet[j] += nassauStake; nassauNet[i] -= nassauStake; }
          }
        }
      }
    }
    rankedNassau = players
      .map((name, i) => ({ name, i, net: nassauNet[i] }))
      .sort((a, b) => b.net - a.net);
    nassauPot = rankedNassau.reduce((s, p) => s + Math.max(p.net, 0), 0);
    firstNassauNet = rankedNassau[0]?.net ?? 0;
  }

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => {}} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />
      <ScrollView contentContainerStyle={styles.content}>
        {isNassau ? (
          <>
            <View style={styles.potCard}>
              <Text style={styles.potLabel}>Nassau Pot</Text>
              <Text style={styles.potValue}>${nassauPot.toFixed(2)}</Text>
              <Text style={styles.potSub}>${nassauStake.toFixed(2)}/leg · {nassauLegsRanges.length} legs</Text>
            </View>
            {rankedNassau.map((p, rank) => {
              const isFirst = p.net === firstNassauNet && firstNassauNet > 0;
              return (
                <View key={p.i} style={[styles.row, isFirst && styles.rowFirst]}>
                  <Text style={styles.medal}>{MEDALS[rank] || `${rank + 1}.`}</Text>
                  <Avatar name={p.name} size={40} />
                  <Text style={styles.name}>{p.name}</Text>
                  <View style={styles.right}>
                    <Text style={[styles.beans, p.net < 0 && styles.neg]}>
                      {p.net >= 0 ? `+$${p.net.toFixed(2)}` : `-$${Math.abs(p.net).toFixed(2)}`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <>
            <View style={styles.potCard}>
              <Text style={styles.potLabel}>Total Bean Pot</Text>
              <Text style={styles.potValue}>${pot.toFixed(2)}</Text>
              <Text style={styles.potSub}>${beanValue.toFixed(2)} per bean</Text>
            </View>
            {rankedBeans.map((p, rank) => {
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
          </>
        )}
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
