import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../context/GameContext';
import { getEffectiveValue, totalBeansForPlayer, getEffectiveBeanValue, beansAtHoleForPlayer } from '../utils/beans';
import { colors, spacing, radius, shadow } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';

export default function BreakdownScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const { players, scores, firstBonus, beanValue, bonusBeanDescs = {}, holeCount = 18, holeOffset = 0,
    pressMode, presses = [], tenthPressed = false, tenthPressValue, holePresses = {}, spots = [] } = state;
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
        {/* Summary header */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryGlow} />
          <Text style={styles.summaryName}>{players[selectedPlayer]}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, netDollars < 0 && styles.neg]}>
                {netDollars >= 0 ? '+' : ''}${Math.abs(netDollars).toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>net</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{events.filter(e => !e.incoming).length}</Text>
              <Text style={styles.summaryLabel}>{events.filter(e => !e.incoming).length === 1 ? 'event' : 'events'}</Text>
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
});
