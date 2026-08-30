import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../context/GameContext';
import { getEffectiveValue, totalBeansForPlayer, getEffectiveBeanValue, beansAtHoleForPlayer, computePressSettleUp } from '../utils/beans';
import { holeWinner } from '../utils/nassau';
import { colors, spacing, radius, shadow } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';

export default function BreakdownScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const { players, scores, firstBonus, beanValue, bonusBeanDescs = {}, holeCount = 18, holeOffset = 0,
    pressMode, presses = [], tenthPressed = false, tenthPressValue, holePresses = {}, spots = [],
    gameMode = 'beans', nassauStake = 5.00, strokes = [] } = state;
  const isNassau = gameMode === 'nassau';
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [paywallVisible, setPaywallVisible] = useState(false);

  // Build flat list of bean events for the selected player
  const events = [];

  // Own events (beans this player scored directly)
  for (let h = 0; h < holeCount; h++) {
    const holeScores = scores[selectedPlayer]?.[h] || {};
    for (const bean of activeBeans) {
      if (bean.awardToOthers) continue; // putter doesn't lose beans; recipients gain them
      const count = holeScores[bean.id] || 0;
      if (count === 0) continue;
      const ev    = getEffectiveValue(bean, selectedPlayer, h, firstBonus);
      const beans = count * ev;
      const first = firstBonus?.[bean.id];
      const isFirst = bean.fb && first?.playerIdx === selectedPlayer && first?.holeIdx === h;
      const par   = getHolePar(h);
      events.push({ h, holeNum: holeOffset + h + 1, par, bean, count, beans, isFirst, incoming: false });
    }
  }

  // Incoming events: negative beans from other players each pay selectedPlayer
  for (let h = 0; h < holeCount; h++) {
    for (const bean of activeBeans) {
      if (!bean.awardToOthers) continue; // only awardToOthers beans pay out to other players
      for (let op = 0; op < players.length; op++) {
        if (op === selectedPlayer) continue;
        const count = scores[op]?.[h]?.[bean.id] || 0;
        if (count === 0) continue;
        const ev          = getEffectiveValue(bean, op, h, firstBonus); // negative
        const beansIn     = count * Math.abs(ev);
        const first       = firstBonus?.[bean.id];
        const isFirst     = bean.fb && first?.playerIdx === op && first?.holeIdx === h;
        const par         = getHolePar(h);
        events.push({ h, holeNum: holeOffset + h + 1, par, bean, count, beans: beansIn, isFirst, incoming: true, from: op });
      }
    }
  }

  // Chronological order
  events.sort((a, b) => a.h - b.h);

  const grandTotal  = totalBeansForPlayer(selectedPlayer, scores, activeBeans, firstBonus);
  const n           = players.length;

  // Press-aware net dollars: compute per-hole with effective bean value
  let netDollars = 0;
  for (let h = 0; h < holeCount; h++) {
    const effVal = getEffectiveBeanValue(beanValue, h, pressMode, presses, tenthPressed, tenthPressValue);
    const myB = beansAtHoleForPlayer(selectedPlayer, h, scores, activeBeans, firstBonus, n);
    const totalHB = players.reduce((s, _, pi) => s + beansAtHoleForPlayer(pi, h, scores, activeBeans, firstBonus, n), 0);
    netDollars += effVal * (myB * n - totalHB);
    const holePress = holePresses[h];
    if (pressMode === 'perHole' && holePress?.playerIdxs?.includes(selectedPlayer)) {
      const { playerIdxs, value: pressVal = beanValue } = holePress;
      const np = playerIdxs.length;
      const myPB = beansAtHoleForPlayer(selectedPlayer, h, scores, activeBeans, firstBonus, n);
      const totalPB = playerIdxs.reduce((s, pi) => s + beansAtHoleForPlayer(pi, h, scores, activeBeans, firstBonus, n), 0);
      netDollars += pressVal * (myPB * np - totalPB);
    }
  }

  // Gross earned from own events (collected from all opponents) and what was paid to others
  let grossEarned = 0;
  events.forEach(event => {
    const effVal = getEffectiveBeanValue(beanValue, event.h, pressMode, presses, tenthPressed, tenthPressValue);
    grossEarned += event.incoming
      ? event.beans * effVal
      : event.beans * (n - 1) * effVal;
  });
  const grossPaid = grossEarned - netDollars;

  // Gross paid to each other player for their bean wins (before netting)
  const paidToPlayers = players
    .map((_, op) => {
      if (op === selectedPlayer) return null;
      let amt = 0;
      for (let h = 0; h < holeCount; h++) {
        const effVal = getEffectiveBeanValue(beanValue, h, pressMode, presses, tenthPressed, tenthPressValue);
        amt += beansAtHoleForPlayer(op, h, scores, activeBeans, firstBonus, n) * effVal;
      }
      return amt > 0 ? { name: players[op].split(' ')[0], amt } : null;
    })
    .filter(Boolean);

  function beanDesc(event) {
    const { bean, count, isFirst, incoming, from } = event;
    let label = bean.name;
    if (bean.id === 'lowBall')   label = 'Low Ball (skin)';
    if (bean.id === 'longDrive') label = 'Long Drive';
    if (bean.id === 'kp')        label = 'Closest to Pin';
    if (bean.id === 'bonusBean') {
      const desc = bonusBeanDescs[event.h];
      label = desc ? `Bonus Bean — ${desc}` : 'Bonus Bean';
    }
    if (incoming) {
      return `From ${players[from].split(' ')[0]}'s ${label}${isFirst ? ' (first)' : ''}`;
    }
    if (count > 1 && !bean.fb)   label += ` ×${count}`;
    if (isFirst)                 label += ' — first of round';
    return label;
  }

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />

      {/* Player tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.playerTabs}
        contentContainerStyle={{ padding: spacing.sm, gap: spacing.xs }}
      >
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
        {isNassau ? (
          /* Nassau: hole-by-hole stroke comparison */
          <>
            <View style={styles.nassauHeader}>
              <Text style={styles.nassauHeaderName}>{players[selectedPlayer]}</Text>
              <Text style={styles.nassauHeaderSub}>${nassauStake.toFixed(2)}/leg · hole-by-hole results</Text>
            </View>
            <View style={styles.nassauTableHeader}>
              <Text style={[styles.nassauCol, styles.nassauColHole]}>HOLE</Text>
              {players.map((name, pi) => (
                <Text key={pi} style={[styles.nassauCol, pi === selectedPlayer && styles.nassauColActive]}>
                  {name.split(' ')[0].toUpperCase()}
                </Text>
              ))}
              <Text style={[styles.nassauCol, styles.nassauColResult]}>RESULT</Text>
            </View>
            {Array.from({ length: holeCount }, (_, h) => {
              const par = getHolePar(h);
              const playerIdxs = players.map((_, i) => i);
              const winner = holeWinner(strokes, playerIdxs, h);
              const allEntered = playerIdxs.every(pi => (strokes[pi]?.[h] ?? 0) > 0);
              let resultText = '—';
              let resultStyle = styles.nassauResultPending;
              if (allEntered) {
                if (winner === -1) { resultText = 'Halved'; resultStyle = styles.nassauResultHalve; }
                else if (winner === selectedPlayer) { resultText = 'WIN'; resultStyle = styles.nassauResultWin; }
                else { resultText = `${players[winner].split(' ')[0]} wins`; resultStyle = styles.nassauResultLoss; }
              }
              return (
                <View key={h} style={styles.nassauTableRow}>
                  <View style={styles.nassauColHoleCell}>
                    <Text style={styles.nassauHoleNum}>{holeOffset + h + 1}</Text>
                    <Text style={styles.nassauHolePar}>P{par}</Text>
                  </View>
                  {players.map((_, pi) => {
                    const s = strokes[pi]?.[h] ?? 0;
                    const relPar = s > 0 ? s - par : null;
                    const isWin = allEntered && winner === pi;
                    return (
                      <Text key={pi} style={[styles.nassauCol, styles.nassauStroke, pi === selectedPlayer && styles.nassauColActive, isWin && styles.nassauStrokeWin]}>
                        {s > 0 ? s : '—'}{relPar !== null ? ` (${relPar >= 0 ? '+' : ''}${relPar === 0 ? 'E' : relPar})` : ''}
                      </Text>
                    );
                  })}
                  <Text style={[styles.nassauCol, styles.nassauColResult, resultStyle]}>{resultText}</Text>
                </View>
              );
            })}
          </>
        ) : (
          /* Beans: existing view */
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryGlow} />
              <Text style={styles.summaryName}>{players[selectedPlayer]}</Text>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryVal}>+${grossEarned.toFixed(2)}</Text>
                  <Text style={styles.summaryLabel}>earned</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryVal, grossPaid > 0 && styles.neg]}>
                    {grossPaid > 0 ? `-$${grossPaid.toFixed(2)}` : '$0.00'}
                  </Text>
                  <Text style={styles.summaryLabel}>
                    {paidToPlayers.length > 0
                      ? `to ${paidToPlayers.map(p => `${p.name} $${p.amt.toFixed(2)}`).join(', ')}`
                      : 'paid'}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryVal, netDollars < 0 && styles.neg]}>
                    {netDollars >= 0 ? '+' : ''}${Math.abs(netDollars).toFixed(2)}
                  </Text>
                  <Text style={styles.summaryLabel}>net</Text>
                </View>
              </View>
            </View>

            {events.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>⛳</Text>
                <Text style={styles.empty}>No beans recorded yet for {players[selectedPlayer]}.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionLabel}>Bean by bean</Text>
                {events.map((event, idx) => (
                  <View key={idx} style={[styles.eventRow, event.beans < 0 && styles.eventRowNeg]}>
                    <View style={styles.eventLeft}>
                      <Text style={styles.eventHole}>Hole {event.holeNum}</Text>
                      <Text style={styles.eventPar}>Par {event.par}</Text>
                    </View>
                    <View style={styles.eventMid}>
                      <Text style={styles.eventDesc}>{beanDesc(event)}</Text>
                    </View>
                    <Text style={[styles.eventBeans, event.beans < 0 && styles.neg]}>
                      {(() => {
                        const total = event.incoming ? event.beans : event.beans * (n - 1);
                        return total >= 0 ? `+${total}` : `${total}`;
                      })()}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: colors.background },

  playerTabs:    { backgroundColor: colors.white, maxHeight: 60, ...shadow.sm, zIndex: 5 },
  tab:           { paddingHorizontal: spacing.md, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center' },
  tabActive:     { backgroundColor: colors.green, borderColor: colors.green, ...shadow.green },
  tabText:       { fontSize: 14, fontWeight: '700', color: colors.textMid },
  tabTextActive: { color: colors.white, fontWeight: '800' },

  content:       { padding: spacing.md, paddingBottom: 100 },

  summaryCard:   { backgroundColor: colors.green, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, overflow: 'hidden', ...shadow.green },
  summaryGlow:   { position: 'absolute', top: -60, right: -30, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(45,107,68,0.45)' },
  summaryName:   { fontSize: 20, fontWeight: '900', color: colors.white, marginBottom: spacing.md, letterSpacing: -0.4 },
  summaryRow:    { flexDirection: 'row', alignItems: 'center' },
  summaryItem:   { flex: 1, alignItems: 'center' },
  summaryVal:    { fontSize: 27, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  summaryLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 },
  summaryDivider:{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.22)' },
  neg:           { color: '#ffb3b3' },

  sectionLabel:  { fontSize: 11, fontWeight: '800', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.sm, marginLeft: 2 },

  eventRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderLeftWidth: 4, borderLeftColor: colors.green, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, ...shadow.sm },
  eventRowNeg:   { borderLeftColor: colors.red },
  eventLeft:     { alignItems: 'center', minWidth: 48, backgroundColor: colors.greenPale, borderRadius: radius.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs },
  eventHole:     { fontSize: 13, fontWeight: '900', color: colors.green },
  eventPar:      { fontSize: 10, color: colors.textMid, fontWeight: '700', marginTop: 1 },
  eventMid:      { flex: 1 },
  eventDesc:     { fontSize: 14, fontWeight: '700', color: colors.textDark },
  eventBeans:    { fontSize: 17, fontWeight: '900', color: colors.green, textAlign: 'right', letterSpacing: -0.3 },
  eventDollar:   { fontSize: 11, fontWeight: '700', color: colors.textMid },

  emptyWrap:     { alignItems: 'center', marginTop: 70, paddingHorizontal: spacing.xl },
  emptyIcon:     { fontSize: 52, marginBottom: spacing.md },
  empty:         { color: colors.textMid, textAlign: 'center', fontSize: 16, fontWeight: '600', lineHeight: 24 },

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
  nassauColResult:    { flex: 1.4, textAlign: 'right' },
  nassauHoleNum:      { fontSize: 14, fontWeight: '900', color: colors.textDark },
  nassauHolePar:      { fontSize: 10, color: colors.textLight, fontWeight: '600' },
  nassauStroke:       { fontSize: 13, color: colors.textDark },
  nassauStrokeWin:    { color: colors.green, fontWeight: '900' },
  nassauResultPending:{ color: colors.textLight, fontStyle: 'italic' },
  nassauResultWin:    { color: colors.green, fontWeight: '900' },
  nassauResultHalve:  { color: colors.gold, fontWeight: '700' },
  nassauResultLoss:   { color: colors.red, fontWeight: '700' },
});
