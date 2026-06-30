import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useGame } from '../context/GameContext';
import { getEffectiveValue, totalBeansForPlayer } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';

export default function BreakdownScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const { players, scores, firstBonus, beanValue, holeCount = 18, holeOffset = 0 } = state;
  const [selectedPlayer, setSelectedPlayer] = useState(0);
  const [paywallVisible, setPaywallVisible] = useState(false);

  // Build flat list of bean events for the selected player
  const events = [];
  for (let h = 0; h < holeCount; h++) {
    const holeScores = scores[selectedPlayer]?.[h] || {};
    for (const bean of activeBeans) {
      const count = holeScores[bean.id] || 0;
      if (count === 0) continue;
      const ev    = getEffectiveValue(bean, selectedPlayer, h, firstBonus);
      const beans = count * ev;
      const first = firstBonus?.[bean.id];
      const isFirst = bean.fb && first?.playerIdx === selectedPlayer && first?.holeIdx === h;
      const par   = getHolePar(h);
      events.push({ h, holeNum: holeOffset + h + 1, par, bean, count, beans, isFirst });
    }
  }

  const grandTotal = totalBeansForPlayer(selectedPlayer, scores, activeBeans, firstBonus);

  function beanDesc(event) {
    const { bean, count, isFirst } = event;
    let label = bean.name;
    if (bean.id === 'lowBall')   label = 'Low Ball (skin)';
    if (bean.id === 'longDrive') label = 'Long Drive';
    if (bean.id === 'kp')        label = 'Closest to Pin';
    if (count > 1 && !bean.fb)   label += ` ×${count}`;
    if (isFirst)                 label += ' — first of round';
    return label;
  }

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} />

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
          <Text style={styles.summaryName}>{players[selectedPlayer]}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, grandTotal < 0 && styles.neg]}>
                {grandTotal >= 0 ? `+${grandTotal}` : grandTotal}
              </Text>
              <Text style={styles.summaryLabel}>beans</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryVal, grandTotal < 0 && styles.neg]}>
                {grandTotal >= 0 ? '+' : ''}${(grandTotal * beanValue).toFixed(2)}
              </Text>
              <Text style={styles.summaryLabel}>net</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryVal}>{events.length}</Text>
              <Text style={styles.summaryLabel}>{events.length === 1 ? 'event' : 'events'}</Text>
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
                  {event.beans >= 0 ? `+${event.beans}` : event.beans}
                  {'\n'}
                  <Text style={styles.eventDollar}>
                    {event.beans >= 0 ? '+' : ''}${(event.beans * beanValue).toFixed(2)}
                  </Text>
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

  playerTabs:    { backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border, maxHeight: 56 },
  tab:           { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
  tabActive:     { backgroundColor: colors.green },
  tabText:       { fontSize: 14, fontWeight: '600', color: colors.textMid },
  tabTextActive: { color: colors.white },

  content:       { padding: spacing.md, paddingBottom: 100 },

  summaryCard:   { backgroundColor: colors.green, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md },
  summaryName:   { fontSize: 18, fontWeight: '800', color: colors.white, marginBottom: spacing.sm },
  summaryRow:    { flexDirection: 'row', alignItems: 'center' },
  summaryItem:   { flex: 1, alignItems: 'center' },
  summaryVal:    { fontSize: 24, fontWeight: '900', color: colors.white },
  summaryLabel:  { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  summaryDivider:{ width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.25)' },
  neg:           { color: '#ffb3b3' },

  sectionLabel:  { fontSize: 11, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },

  eventRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: colors.green, padding: spacing.md, marginBottom: spacing.xs, gap: spacing.sm },
  eventRowNeg:   { borderLeftColor: colors.red },
  eventLeft:     { alignItems: 'center', minWidth: 44 },
  eventHole:     { fontSize: 13, fontWeight: '800', color: colors.textDark },
  eventPar:      { fontSize: 11, color: colors.textLight, fontWeight: '600' },
  eventMid:      { flex: 1 },
  eventDesc:     { fontSize: 14, fontWeight: '600', color: colors.textDark },
  eventBeans:    { fontSize: 15, fontWeight: '800', color: colors.green, textAlign: 'right' },
  eventDollar:   { fontSize: 11, fontWeight: '600', color: colors.textMid },

  emptyWrap:     { alignItems: 'center', marginTop: 60 },
  emptyIcon:     { fontSize: 40, marginBottom: spacing.sm },
  empty:         { color: colors.textLight, textAlign: 'center', fontSize: 15 },
});
