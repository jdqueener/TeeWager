import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { useGame } from '../context/GameContext';
import { getEffectiveValue, totalBeansForTeam, beansAtHoleForTeam } from '../utils/beans';
import { holeWinner, holeResultTeam } from '../utils/nassau';
import { teamShortName, teamPlayerNames } from '../utils/teams';
import { colors, spacing, radius, shadow } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';

export default function BreakdownScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const { players, scores, firstBonus, bonusBeanDescs = {}, holeCount = 18, holeOffset = 0,
    gameMode = 'beans', nassauStake = 5.00, strokes = [], nassauTeams = null, nassauTeamFormat = 'match-play',
    beansTeams = null } = state;
  const isNassau = gameMode === 'nassau';
  const isTeams = isNassau && !!nassauTeams;
  const [teamA, teamB] = isTeams ? nassauTeams : [[], []];
  // Short "Team A"/"Team B" labels are the primary name used everywhere
  // (tabs, results, payments); full player names are shown once, as a
  // subtitle, so a longer roster never truncates a tight label or chip.
  const teamNames = isTeams ? [teamShortName(0), teamShortName(1)] : [];
  const teamPlayerLabels = isTeams ? [teamPlayerNames(players, teamA), teamPlayerNames(players, teamB)] : [];
  const isBeansTeams = !isNassau && beansTeams?.length === 2;
  const beansTeamNames = isBeansTeams ? beansTeams.map((_, ti) => teamShortName(ti)) : [];
  const [paywallVisible, setPaywallVisible] = useState(false);
  // { pi, h } of the cell whose detail popup is open, or null
  const [detailCell, setDetailCell] = useState(null);

  // Beans grid columns: one per real player, or one per team in 2v2 scramble
  // (each column's `team` sums its real members' individually-earned beans).
  const beansColumns = isBeansTeams
    ? beansTeams.map((team, ti) => ({ pi: team[0], team, label: beansTeamNames[ti] }))
    : players.map((p, i) => ({ pi: i, team: [i], label: p.split(' ')[0] }));

  function beanLabel(bean, h, count, pi) {
    let label = bean.name;
    if (bean.id === 'lowBall')   label = 'Skins';
    if (bean.id === 'longDrive') label = 'Long Drive';
    if (bean.id === 'kp')        label = 'Closest to Pin';
    if (bean.id === 'bonusBean') {
      const desc = bonusBeanDescs[h];
      label = desc ? `Bonus Bean — ${desc}` : 'Bonus Bean';
    }
    if (count > 1 && !bean.fb) label += ` ×${count}`;
    const first = firstBonus?.[bean.id];
    if (bean.fb && first?.playerIdx === pi && first?.holeIdx === h) label += ' — first of round';
    return label;
  }

  // Every bean contributing to a column's total on one hole — own wins plus
  // any incoming penalty beans from other players' mistakes that hole. A
  // team column sums both real members, prefixed by name so it's clear who
  // earned what within the team.
  function cellItems(team, h) {
    const items = [];
    for (const pi of team) {
      const prefix = team.length > 1 ? `${players[pi].split(' ')[0]} — ` : '';
      for (const bean of activeBeans) {
        if (bean.awardToOthers) {
          for (let op = 0; op < players.length; op++) {
            if (op === pi) continue;
            const count = scores[op]?.[h]?.[bean.id] || 0;
            if (!count) continue;
            const ev = Math.abs(getEffectiveValue(bean, op, h, firstBonus));
            items.push({ label: `${prefix}From ${players[op].split(' ')[0]}'s ${bean.name}${count > 1 ? ` ×${count}` : ''}`, beans: count * ev });
          }
        } else {
          const count = scores[pi]?.[h]?.[bean.id] || 0;
          if (!count) continue;
          const ev = getEffectiveValue(bean, pi, h, firstBonus);
          items.push({ label: `${prefix}${beanLabel(bean, h, count, pi)}`, beans: count * ev });
        }
      }
    }
    return items;
  }

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />

      <ScrollView contentContainerStyle={styles.content}>
        {isNassau ? (
          /* Nassau: hole-by-hole stroke comparison — winner shown absolutely
             (not relative to a selected player), so every hole is readable
             from one table with no tabbing required. */
          <>
            <View style={styles.nassauHeader}>
              <Text style={styles.nassauHeaderName}>Nassau Results</Text>
              <Text style={styles.nassauHeaderSub}>
                ${nassauStake.toFixed(2)}/leg{isTeams ? ` · 2v2 ${nassauTeamFormat.replace('-', ' ')}` : ''} · hole-by-hole results
              </Text>
              {isTeams && (
                <Text style={styles.nassauHeaderSub} numberOfLines={2}>
                  {teamNames[0]} ({teamPlayerLabels[0]}) vs {teamNames[1]} ({teamPlayerLabels[1]})
                </Text>
              )}
            </View>
            <View style={styles.nassauTableHeader}>
              <Text style={[styles.nassauCol, styles.nassauColHole]}>HOLE</Text>
              {isTeams
                ? teamNames.map((tn, ti) => <Text key={ti} style={styles.nassauCol}>{tn.toUpperCase()}</Text>)
                : players.map((name, pi) => (
                    <Text key={pi} style={styles.nassauCol}>
                      {name.split(' ')[0].toUpperCase()}
                    </Text>
                  ))}
              <Text style={[styles.nassauCol, styles.nassauColResult]}>RESULT</Text>
            </View>
            {Array.from({ length: holeCount }, (_, h) => {
              const par = getHolePar(h);
              const playerIdxs = players.map((_, i) => i);
              let winner, allEntered, teamResult;
              if (isTeams) {
                // scoreA/scoreB are already each team's recorded score for the
                // hole — best-ball for match play, the shared entry for
                // scramble — so the table shows one column per team, not one
                // per player.
                teamResult = holeResultTeam(strokes, teamA, teamB, h, nassauTeamFormat);
                winner = teamResult.winner;
                allEntered = winner !== null;
              } else {
                winner = holeWinner(strokes, playerIdxs, h);
                allEntered = playerIdxs.every(pi => (strokes[pi]?.[h] ?? 0) > 0);
              }
              let resultText = '—';
              let resultStyle = styles.nassauResultPending;
              if (allEntered) {
                if (winner === -1) { resultText = 'Halved'; resultStyle = styles.nassauResultHalve; }
                else if (isTeams) {
                  // Always name the winning team — never just "WIN" — so 2v2 results read as team, not individual.
                  resultText = `${teamNames[winner]} win`;
                  resultStyle = styles.nassauResultWin;
                } else { resultText = `${players[winner].split(' ')[0]} wins`; resultStyle = styles.nassauResultWin; }
              }
              return (
                <View key={h} style={styles.nassauTableRow}>
                  <View style={styles.nassauColHoleCell}>
                    <Text style={styles.nassauHoleNum}>{holeOffset + h + 1}</Text>
                    <Text style={styles.nassauHolePar}>P{par}</Text>
                  </View>
                  {(isTeams ? [teamResult.scoreA, teamResult.scoreB] : players.map((_, pi) => strokes[pi]?.[h] ?? 0)).map((s, idx) => {
                    const relPar = s > 0 ? s - par : null;
                    const isWin = allEntered && winner === idx;
                    return (
                      <Text key={idx} style={[styles.nassauCol, styles.nassauStroke, isWin && styles.nassauStrokeWin]}>
                        {s > 0 ? s : '—'}{relPar !== null ? ` (${relPar >= 0 ? '+' : ''}${relPar === 0 ? 'E' : relPar})` : ''}
                      </Text>
                    );
                  })}
                  <Text style={[styles.nassauCol, styles.nassauColResult, resultStyle]} numberOfLines={2}>{resultText}</Text>
                </View>
              );
            })}
          </>
        ) : (
          /* Beans: one shared table — rows are holes, columns are players
             (or teams), so everyone's beans are visible at a glance while
             scrolling through the round with no tabbing required. Dollar
             totals live on the scorecard already, so this screen only shows
             raw bean counts. */
          <>
            <Text style={styles.sectionLabel}>Beans by hole</Text>
            <View style={styles.nassauTableHeader}>
              <Text style={[styles.nassauCol, styles.nassauColHole]}>HOLE</Text>
              {beansColumns.map(({ pi, team, label }) => {
                const total = totalBeansForTeam(team, scores, activeBeans, firstBonus);
                return (
                  <View key={pi} style={styles.beanColHeaderWrap}>
                    <Text style={styles.beanColHeaderName} numberOfLines={1}>{label.toUpperCase()}</Text>
                    <Text style={total > 0 ? styles.beanColHeaderTotal : styles.beanColHeaderTotalEmpty}>
                      {total > 0 ? `+${total}` : total}
                    </Text>
                  </View>
                );
              })}
            </View>
            {Array.from({ length: holeCount }, (_, h) => {
              const par = getHolePar(h);
              return (
                <View key={h} style={styles.nassauTableRow}>
                  <View style={styles.nassauColHoleCell}>
                    <Text style={styles.nassauHoleNum}>{holeOffset + h + 1}</Text>
                    <Text style={styles.nassauHolePar}>P{par}</Text>
                  </View>
                  {beansColumns.map(({ pi, team, label }) => {
                    const total = beansAtHoleForTeam(team, h, scores, activeBeans, firstBonus, players.length);
                    const items = total !== 0 ? cellItems(team, h) : [];
                    const cell = (
                      <View style={styles.beanCellInner}>
                        <Text style={total > 0 ? styles.beanCellVal : styles.beanCellValEmpty}>
                          {total > 0 ? `+${total}` : '—'}
                        </Text>
                        {items.length > 1 && <View style={styles.beanCellBadge} />}
                      </View>
                    );
                    return items.length > 0 ? (
                      <TouchableOpacity key={pi} style={styles.nassauCol} onPress={() => setDetailCell({ team, h, label })}>
                        {cell}
                      </TouchableOpacity>
                    ) : (
                      <View key={pi} style={styles.nassauCol}>{cell}</View>
                    );
                  })}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={!!detailCell} transparent animationType="fade" onRequestClose={() => setDetailCell(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDetailCell(null)}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {detailCell && (() => {
                const { team, h, label } = detailCell;
                const items = cellItems(team, h);
                return (
                  <>
                    <Text style={styles.modalTitle}>{label} — Hole {holeOffset + h + 1}</Text>
                    {items.map((it, idx) => (
                      <View key={idx} style={styles.modalRow}>
                        <Text style={styles.modalRowLabel}>{it.label}</Text>
                        <Text style={styles.modalRowBeans}>+{it.beans}</Text>
                      </View>
                    ))}
                    <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDetailCell(null)}>
                      <Text style={styles.modalCloseBtnText}>Close</Text>
                    </TouchableOpacity>
                  </>
                );
              })()}
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },

  content:       { padding: spacing.md, paddingBottom: 100 },

  sectionLabel:  { fontSize: 11, fontWeight: '800', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: 2 },

  // Beans grid cells (columns reuse nassauCol/nassauTable* below for a
  // consistent hole-by-hole table look across both game modes)
  beanCellInner:    { alignItems: 'center', justifyContent: 'center' },
  beanCellVal:      { fontSize: 15, fontWeight: '900', color: colors.green },
  beanCellValEmpty: { fontSize: 15, fontWeight: '700', color: colors.textLight },
  beanCellBadge:    { position: 'absolute', top: -2, right: -8, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gold },

  beanColHeaderWrap:      { flex: 1, alignItems: 'center' },
  beanColHeaderName:      { fontSize: 11, fontWeight: '800', color: colors.textMid, textAlign: 'center' },
  beanColHeaderTotal:     { fontSize: 13, fontWeight: '900', color: colors.green, marginTop: 2 },
  beanColHeaderTotalEmpty:{ fontSize: 13, fontWeight: '700', color: colors.textLight, marginTop: 2 },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  modalCard:        { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 360, ...shadow.md },
  modalTitle:       { fontSize: 16, fontWeight: '900', color: colors.textDark, marginBottom: spacing.md },
  modalRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  modalRowLabel:    { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textDark, marginRight: spacing.sm },
  modalRowBeans:    { fontSize: 15, fontWeight: '900', color: colors.green },
  modalCloseBtn:    { marginTop: spacing.md, alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  modalCloseBtnText:{ fontSize: 14, fontWeight: '800', color: colors.green },

  // Nassau breakdown
  nassauHeader:       { backgroundColor: colors.green, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  nassauHeaderName:   { fontSize: 20, fontWeight: '900', color: colors.white },
  nassauHeaderSub:    { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  nassauTableHeader:  { flexDirection: 'row', paddingHorizontal: spacing.sm, paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs },
  nassauTableRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, marginBottom: 4, borderWidth: 0.5, borderColor: colors.border },
  nassauCol:          { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textMid, textAlign: 'center' },
  nassauColActive:    { color: colors.green },
  nassauColHole:      { flex: 0.7, textAlign: 'left' },
  nassauColHoleCell:  { flex: 0.7, alignItems: 'flex-start' },
  nassauColResult:    { flex: 1.8, textAlign: 'right', lineHeight: 16 },
  nassauHoleNum:      { fontSize: 14, fontWeight: '900', color: colors.textDark },
  nassauHolePar:      { fontSize: 10, color: colors.textLight, fontWeight: '600' },
  nassauStroke:       { fontSize: 13, color: colors.textDark },
  nassauStrokeWin:    { color: colors.green, fontWeight: '900' },
  nassauResultPending:{ color: colors.textLight, fontStyle: 'italic' },
  nassauResultWin:    { color: colors.green, fontWeight: '900' },
  nassauResultHalve:  { color: colors.gold, fontWeight: '700' },
  nassauResultLoss:   { color: colors.red, fontWeight: '700' },
});
