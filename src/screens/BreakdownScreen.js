import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Modal, TouchableWithoutFeedback } from 'react-native';
import { useGame } from '../context/GameContext';
import { getEffectiveValue, totalBeansForTeam, beansAtHoleForTeam, totalBeansForPlayer, beansAtHoleForPlayer, teamAwardedBeansForScrambleTeam, teamAwardedBeansAtHoleForScrambleTeam, TEAM_SCRAMBLE_INDIVIDUAL_BEAN_IDS } from '../utils/beans';
import { holeWinner, holeResultTeam, legMatchStatus, legMatchStatusTeam, relevantPairPresses, pairLegNet, teamLegNet } from '../utils/nassau';
import { teamShortName, teamPlayerNames } from '../utils/teams';
import { colors, spacing, radius, shadow } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';

export default function BreakdownScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const { players, scores, firstBonus, bonusBeanDescs = {}, holeCount = 18, holeOffset = 0,
    gameMode = 'beans', nassauStake = 5.00, strokes = [], nassauTeams = null, nassauTeamFormat = 'match-play',
    nassauScoring = 'match', nassauPresses = { front: [], back: [], total: [] }, beansTeams = null } = state;
  const isNassau = gameMode === 'nassau';
  const isTeams = isNassau && !!nassauTeams;
  const isIndividualMatch = isNassau && !isTeams && nassauScoring === 'match';
  const playerIdxs = players.map((_, i) => i);
  const [teamA, teamB] = isTeams ? nassauTeams : [[], []];
  const [matchupsOpen, setMatchupsOpen] = useState(false);
  const [matchupsPlayerTab, setMatchupsPlayerTab] = useState(0);
  const [expandedBetGroups, setExpandedBetGroups] = useState(new Set());
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
  // 2v2 beans scramble only: a "Team B +1" column mixing one real player's
  // individual win with the team's own beans reads as if the team earned
  // it together, which it didn't — so individual and team-awarded beans
  // get entirely separate views here instead of one blended total.
  const [beansView, setBeansView] = useState('individual'); // 'individual' | 'team'

  const individualBeanDefs = activeBeans.filter(b => TEAM_SCRAMBLE_INDIVIDUAL_BEAN_IDS.includes(b.id));

  // Beans grid columns: one per real player (individual view, or non-team
  // games), or one per team (2v2 team view).
  const beansColumns = isBeansTeams
    ? (beansView === 'team'
        ? beansTeams.map((team, ti) => ({ pi: team[0], ti, team, label: beansTeamNames[ti] }))
        : players.map((p, i) => ({ pi: i, ti: null, team: [i], label: p.split(' ')[0] })))
    : players.map((p, i) => ({ pi: i, ti: null, team: [i], label: p.split(' ')[0] }));

  function columnTotal(col) {
    if (!isBeansTeams) return totalBeansForTeam(col.team, scores, activeBeans, firstBonus);
    return beansView === 'team'
      ? teamAwardedBeansForScrambleTeam(col.ti, beansTeams, scores, activeBeans, firstBonus)
      : totalBeansForPlayer(col.pi, scores, individualBeanDefs, firstBonus);
  }
  function columnAtHole(col, h) {
    if (!isBeansTeams) return beansAtHoleForTeam(col.team, h, scores, activeBeans, firstBonus, players.length);
    return beansView === 'team'
      ? teamAwardedBeansAtHoleForScrambleTeam(col.ti, h, beansTeams, scores, activeBeans, firstBonus)
      : beansAtHoleForPlayer(col.pi, h, scores, individualBeanDefs, firstBonus, players.length);
  }
  function columnItems(col, h) {
    if (!isBeansTeams) return cellItems(col.team, h);
    return beansView === 'team' ? teamOnlyCellItems(col.ti, h) : individualOnlyCellItems(col.pi, h);
  }

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

  // 2v2 beans scramble, "Individual" view: only beans a real player earns
  // on their own (see TEAM_SCRAMBLE_INDIVIDUAL_BEAN_IDS) — never any
  // team-awarded bean, even though both can live on the same real player's
  // record when that player happens to be their team's rep.
  function individualOnlyCellItems(pi, h) {
    const items = [];
    for (const bean of activeBeans) {
      if (!TEAM_SCRAMBLE_INDIVIDUAL_BEAN_IDS.includes(bean.id)) continue;
      const count = scores[pi]?.[h]?.[bean.id] || 0;
      if (!count) continue;
      const ev = getEffectiveValue(bean, pi, h, firstBonus);
      items.push({ label: beanLabel(bean, h, count, pi), beans: count * ev });
    }
    return items;
  }

  // 2v2 beans scramble, "Team" view: only beans awarded to the team as a
  // whole — stored on the team's first player, shown as one flat entry (no
  // real player ever gets personal credit for a team win); a penalty bean
  // (3-/4-Putt) only shows up in the *other* team's column, as "From
  // {Team}'s 3-Putt".
  function teamOnlyCellItems(teamIdx, h) {
    const items = [];
    const rep = beansTeams[teamIdx][0];
    for (const bean of activeBeans) {
      if (TEAM_SCRAMBLE_INDIVIDUAL_BEAN_IDS.includes(bean.id)) continue;
      if (bean.awardToOthers) {
        beansTeams.forEach((otherTeam, ot) => {
          if (ot === teamIdx) return;
          const count = scores[otherTeam[0]]?.[h]?.[bean.id] || 0;
          if (!count) return;
          const ev = Math.abs(getEffectiveValue(bean, otherTeam[0], h, firstBonus));
          items.push({ label: `From ${beansTeamNames[ot]}'s ${bean.name}${count > 1 ? ` ×${count}` : ''}`, beans: count * ev });
        });
      } else {
        const count = scores[rep]?.[h]?.[bean.id] || 0;
        if (!count) continue;
        const ev = getEffectiveValue(bean, rep, h, firstBonus);
        items.push({ label: beanLabel(bean, h, count, rep), beans: count * ev });
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
                ${nassauStake.toFixed(2)}/leg{isTeams ? ` · 2v2 ${nassauTeamFormat.replace('-', ' ')}` : ` · ${nassauScoring === 'match' ? 'Match Play' : 'Stroke Play'}`} · hole-by-hole results
              </Text>
              {isTeams && (
                <Text style={styles.nassauHeaderSub} numberOfLines={2}>
                  {teamNames[0]} ({teamPlayerLabels[0]}) vs {teamNames[1]} ({teamPlayerLabels[1]})
                </Text>
              )}
            </View>
            {/* Active Bets ledger: every press adds a new, independent bet
                running from its own start hole to the end of the leg — it
                doesn't replace the base bet or any earlier press, they're
                all still live at once. Lives here (not Scorecard) so it has
                room to breathe without crowding out live score entry. Each
                pair collapses to one net-$ row by default (tap to see the
                Base/Press breakdown); round-robin (3-5 players) adds player
                tabs so you're only looking at your own matchups at a time. */}
            {(isTeams || isIndividualMatch) && (() => {
              const frontRange = Array.from({ length: Math.min(9, holeCount) }, (_, i) => i);
              const backRange  = holeCount >= 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [];
              const legs = [
                { label: 'front', range: frontRange, title: 'Front 9' },
                ...(holeCount >= 18 ? [{ label: 'back', range: backRange, title: 'Back 9' }] : []),
                { label: 'total', range: Array.from({ length: holeCount }, (_, i) => i), title: 'Total' },
              ];
              const isRoundRobin = !isTeams && playerIdxs.length > 2;
              // One "pair" per bet group: the single team pairing for 2v2,
              // or every player pair for individual (round-robin naturally
              // collapses to one pair when there are only 2).
              const pairs = isTeams
                ? [{ key: 'teams', label: `${teamNames[0]} vs ${teamNames[1]}`, a: null, b: null,
                     status: (range) => legMatchStatusTeam(strokes, teamA, teamB, range, teamNames),
                     net: (range, legPresses) => teamLegNet(strokes, teamA, teamB, range, nassauStake, legPresses),
                     nameFor: (amt) => amt > 0 ? teamNames[0] : teamNames[1] }]
                : (() => {
                    const list = [];
                    for (let i = 0; i < playerIdxs.length; i++) {
                      for (let j = i + 1; j < playerIdxs.length; j++) {
                        const a = playerIdxs[i], b = playerIdxs[j];
                        list.push({
                          key: `${a}-${b}`, a, b,
                          label: `${players[a].split(' ')[0]} vs ${players[b].split(' ')[0]}`,
                          status: (range) => legMatchStatus(strokes, [a, b], range, players),
                          net: (range, legPresses) => pairLegNet(strokes, a, b, range, nassauStake, legPresses),
                          nameFor: (amt) => amt > 0 ? players[a].split(' ')[0] : players[b].split(' ')[0],
                        });
                      }
                    }
                    return list;
                  })();
              const startedLegs = legs.filter(leg => leg.range.some(h => playerIdxs.every(pi => (strokes[pi]?.[h] ?? 0) > 0)));
              let totalBets = 0;
              const legGroups = startedLegs.map(leg => {
                const legPresses = nassauPresses[leg.label] || [];
                const groups = pairs.map(pair => {
                  const relevantPresses = isTeams ? legPresses : relevantPairPresses(legPresses, pair.a, pair.b);
                  const rows = [
                    { label: 'Base', range: leg.range },
                    ...relevantPresses.map(p => ({
                      label: `Press · since Hole ${holeOffset + p.startHole + 1}`,
                      range: leg.range.filter(h => h >= p.startHole),
                    })),
                  ].map(row => ({ ...row, status: pair.status(row.range) }));
                  totalBets += rows.length;
                  const net = pair.net(leg.range, legPresses);
                  return { ...pair, rows, net };
                });
                return { leg, groups };
              });
              const visiblePlayerIdx = isRoundRobin
                ? (playerIdxs.includes(matchupsPlayerTab) ? matchupsPlayerTab : playerIdxs[0])
                : null;
              if (totalBets === 0) return null;
              return (
                <View style={styles.nassauMatchupsWrap}>
                  <TouchableOpacity style={styles.nassauMatchupsToggle} onPress={() => setMatchupsOpen(v => !v)} activeOpacity={0.75}>
                    <Text style={styles.nassauMatchupsToggleText}>
                      {matchupsOpen ? '▾ Hide active bets' : `▸ Show active bets (${totalBets})`}
                    </Text>
                  </TouchableOpacity>
                  {matchupsOpen && (
                    <>
                      {isRoundRobin && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nassauPlayerTabs} contentContainerStyle={{ gap: 6 }}>
                          {playerIdxs.map(pi => (
                            <TouchableOpacity
                              key={pi}
                              onPress={() => setMatchupsPlayerTab(pi)}
                              style={[styles.nassauPlayerTab, visiblePlayerIdx === pi && styles.nassauPlayerTabActive]}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.nassauPlayerTabText, visiblePlayerIdx === pi && styles.nassauPlayerTabTextActive]}>
                                {players[pi].split(' ')[0]}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                      {legGroups.map(({ leg, groups }) => {
                        const visibleGroups = isRoundRobin
                          ? groups.filter(g => g.a === visiblePlayerIdx || g.b === visiblePlayerIdx)
                          : groups;
                        return (
                          <View key={leg.label} style={styles.nassauMatchupsLeg}>
                            <Text style={styles.nassauMatchupsLegTitle}>{leg.title} · ${nassauStake.toFixed(2)} each</Text>
                            {visibleGroups.map(group => {
                              const rowKey = `${leg.label}-${group.key}`;
                              const expanded = expandedBetGroups.has(rowKey);
                              const opponentLabel = isRoundRobin
                                ? `vs ${players[group.a === visiblePlayerIdx ? group.b : group.a].split(' ')[0]}`
                                : group.label;
                              const canExpand = group.rows.length > 1;
                              return (
                                <View key={group.key} style={styles.nassauBetGroup}>
                                  <TouchableOpacity
                                    style={styles.nassauMatchupRow}
                                    activeOpacity={canExpand ? 0.6 : 1}
                                    disabled={!canExpand}
                                    onPress={() => setExpandedBetGroups(prev => {
                                      const next = new Set(prev);
                                      next.has(rowKey) ? next.delete(rowKey) : next.add(rowKey);
                                      return next;
                                    })}
                                  >
                                    <Text style={styles.nassauMatchupNames} numberOfLines={1}>
                                      {opponentLabel}{canExpand ? (expanded ? '  ▾' : '  ▸') : ''}
                                    </Text>
                                    <Text style={styles.nassauMatchupStatus} numberOfLines={1}>
                                      {group.net === 0 ? 'Push' : `${group.nameFor(group.net)} +$${Math.abs(group.net).toFixed(2)}`}
                                    </Text>
                                  </TouchableOpacity>
                                  {expanded && group.rows.map((row, idx) => (
                                    <View key={idx} style={styles.nassauMatchupSubRow}>
                                      <Text style={styles.nassauMatchupSubLabel} numberOfLines={1}>{row.label}</Text>
                                      <Text style={styles.nassauMatchupSubStatus} numberOfLines={1}>{row.status}</Text>
                                    </View>
                                  ))}
                                </View>
                              );
                            })}
                          </View>
                        );
                      })}
                    </>
                  )}
                </View>
              );
            })()}
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
            {isBeansTeams && (
              <View style={styles.beansViewToggle}>
                <TouchableOpacity
                  style={[styles.beansViewBtn, beansView === 'individual' && styles.beansViewBtnActive]}
                  onPress={() => setBeansView('individual')}
                >
                  <Text style={[styles.beansViewBtnText, beansView === 'individual' && styles.beansViewBtnTextActive]}>
                    Individual
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.beansViewBtn, beansView === 'team' && styles.beansViewBtnActive]}
                  onPress={() => setBeansView('team')}
                >
                  <Text style={[styles.beansViewBtnText, beansView === 'team' && styles.beansViewBtnTextActive]}>
                    Team
                  </Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.nassauTableHeader}>
              <Text style={[styles.nassauCol, styles.nassauColHole]}>HOLE</Text>
              {beansColumns.map((col) => {
                const total = columnTotal(col);
                return (
                  <View key={col.pi} style={styles.beanColHeaderWrap}>
                    <Text style={styles.beanColHeaderName} numberOfLines={1}>{col.label.toUpperCase()}</Text>
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
                  {beansColumns.map((col) => {
                    const total = columnAtHole(col, h);
                    const items = total !== 0 ? columnItems(col, h) : [];
                    const cell = (
                      <View style={styles.beanCellInner}>
                        <Text style={total > 0 ? styles.beanCellVal : styles.beanCellValEmpty}>
                          {total > 0 ? `+${total}` : '—'}
                        </Text>
                        {items.length > 1 && <View style={styles.beanCellBadge} />}
                      </View>
                    );
                    return items.length > 0 ? (
                      <TouchableOpacity key={col.pi} style={styles.nassauCol} onPress={() => setDetailCell({ col, h })}>
                        {cell}
                      </TouchableOpacity>
                    ) : (
                      <View key={col.pi} style={styles.nassauCol}>{cell}</View>
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
                const { col, h } = detailCell;
                const items = columnItems(col, h);
                return (
                  <>
                    <Text style={styles.modalTitle}>{col.label} — Hole {holeOffset + h + 1}</Text>
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

  // 2v2 beans scramble: Individual/Team view toggle — keeps a real player's
  // personal win and a true team-level win from ever sharing one column, so
  // "Team B +1" always means the team actually earned it, never that one
  // player on the team happened to win something on their own.
  beansViewToggle:      { flexDirection: 'row', backgroundColor: colors.greenPale, borderRadius: radius.pill, padding: 3, marginBottom: spacing.md, alignSelf: 'flex-start' },
  beansViewBtn:          { paddingVertical: 6, paddingHorizontal: 16, borderRadius: radius.pill },
  beansViewBtnActive:    { backgroundColor: colors.green, ...shadow.sm },
  beansViewBtnText:      { fontSize: 13, fontWeight: '700', color: colors.textMid },
  beansViewBtnTextActive:{ color: colors.white },

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

  // Active bets ledger
  nassauMatchupsWrap:      { backgroundColor: colors.green, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.md },
  nassauMatchupsToggle:    { paddingVertical: 4 },
  nassauMatchupsToggleText:{ fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  nassauMatchupsLeg:       { marginTop: 6, marginBottom: 2 },
  nassauMatchupsLegTitle:  { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  nassauPlayerTabs:        { marginTop: 4, marginBottom: 2 },
  nassauPlayerTab:         { paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  nassauPlayerTabActive:   { backgroundColor: colors.gold },
  nassauPlayerTabText:     { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)' },
  nassauPlayerTabTextActive:{ color: colors.white },
  nassauBetGroup:          { marginBottom: 2 },
  nassauMatchupRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  nassauMatchupNames:      { flex: 1, fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)', marginRight: spacing.sm },
  nassauMatchupStatus:     { fontSize: 13, fontWeight: '800', color: colors.white, textAlign: 'right' },
  nassauMatchupSubRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 2, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: 'rgba(255,255,255,0.2)', marginLeft: 2 },
  nassauMatchupSubLabel:   { flex: 1, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', marginRight: spacing.sm },
  nassauMatchupSubStatus:  { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.85)', textAlign: 'right' },
});
