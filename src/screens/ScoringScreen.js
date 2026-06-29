import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';
import { isParAllowed, getEffectiveValue } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';
import PaywallModal from '../components/PaywallModal';
import ProBanner from '../components/ProBanner';

export default function ScoringScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const { players, scores, firstBonus, currentHole, ldCarryover, kpCarryover } = state;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const hole = currentHole;
  const par  = getHolePar(hole);

  function hasBean(playerIdx, beanId) {
    return (scores[playerIdx]?.[hole]?.[beanId] || 0) > 0;
  }

  function togglePlayer(bean, playerIdx) {
    if (!bean.free && !pro) { setPaywallVisible(true); return; }

    const currently = hasBean(playerIdx, bean.id);

    if (bean.id === 'longDrive') {
      if (!currently) {
        if (ldCarryover > 0) {
          dispatch({ type: 'LD_AWARD_WITH_CARRYOVER', playerIdx, holeIdx: hole, totalBeans: 1 + ldCarryover });
        } else {
          players.forEach((_, pi) => {
            if (pi !== playerIdx && hasBean(pi, bean.id))
              dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: hole, beanId: bean.id, delta: -1, bean });
          });
          dispatch({ type: 'AWARD_BEAN', playerIdx, holeIdx: hole, beanId: bean.id, delta: 1, bean });
        }
      } else {
        // Deselecting — restore carryover from the awarded amount
        const awarded = scores[playerIdx]?.[hole]?.longDrive || 1;
        dispatch({ type: 'LD_AWARD_WITH_CARRYOVER', playerIdx: -1, holeIdx: hole, totalBeans: 0 });
        if (awarded > 1) dispatch({ type: 'LD_RESTORE_CARRYOVER', value: awarded - 1 });
      }
    } else if (bean.id === 'kp') {
      if (!currently) {
        if (kpCarryover > 0) {
          dispatch({ type: 'KP_AWARD_WITH_CARRYOVER', playerIdx, holeIdx: hole, totalBeans: 1 + kpCarryover });
        } else {
          players.forEach((_, pi) => {
            if (pi !== playerIdx && hasBean(pi, bean.id))
              dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: hole, beanId: bean.id, delta: -1, bean });
          });
          dispatch({ type: 'AWARD_BEAN', playerIdx, holeIdx: hole, beanId: bean.id, delta: 1, bean });
        }
      } else {
        const awarded = scores[playerIdx]?.[hole]?.kp || 1;
        dispatch({ type: 'KP_AWARD_WITH_CARRYOVER', playerIdx: -1, holeIdx: hole, totalBeans: 0 });
        if (awarded > 1) dispatch({ type: 'KP_RESTORE_CARRYOVER', value: awarded - 1 });
      }
    } else if (bean.solo && !currently) {
      players.forEach((_, pi) => {
        if (pi !== playerIdx && hasBean(pi, bean.id))
          dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: hole, beanId: bean.id, delta: -1, bean });
      });
      dispatch({ type: 'AWARD_BEAN', playerIdx, holeIdx: hole, beanId: bean.id, delta: 1, bean });
    } else {
      dispatch({ type: 'AWARD_BEAN', playerIdx, holeIdx: hole, beanId: bean.id, delta: currently ? -1 : 1, bean });
    }
  }

  function playerTotalBeans(pi) {
    let t = 0;
    activeBeans.forEach(bean => {
      for (let h = 0; h < 18; h++) {
        const count = scores[pi]?.[h]?.[bean.id] || 0;
        t += count * getEffectiveValue(bean, pi, h, firstBonus);
      }
    });
    return t;
  }

  const visibleBeans = activeBeans.filter(b => isParAllowed(b, par));
  const dimmedBeans  = activeBeans.filter(b => !isParAllowed(b, par));

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} />

      {/* Hole nav */}
      <View style={styles.holeNav}>
        <TouchableOpacity
          onPress={() => dispatch({ type: 'SET_HOLE', hole: Math.max(0, hole - 1) })}
          disabled={hole === 0}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, hole === 0 && styles.navDisabled]}>‹</Text>
        </TouchableOpacity>
        <View style={styles.holeCenter}>
          <Text style={styles.holeLabel}>Hole {hole + 1}</Text>
          <Text style={styles.parLabel}>
            Par {par}
            {state.course?.holes?.[hole]?.yardage ? ` · ${state.course.holes[hole].yardage}y` : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => dispatch({ type: 'SET_HOLE', hole: Math.min(17, hole + 1) })}
          disabled={hole === 17}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, hole === 17 && styles.navDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Running totals bar */}
      <View style={styles.totalsBar}>
        {players.map((name, pi) => {
          const t = playerTotalBeans(pi);
          return (
            <View key={pi} style={styles.totalChip}>
              <Text style={styles.totalName} numberOfLines={1}>{name.split(' ')[0]}</Text>
              <Text style={[styles.totalVal, t < 0 && styles.neg]}>{t >= 0 ? `+${t}` : t}</Text>
            </View>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {visibleBeans.map(bean => (
          <BeanCard
            key={bean.id}
            bean={bean}
            players={players}
            hasBean={pi => hasBean(pi, bean.id)}
            onToggle={pi => togglePlayer(bean, pi)}
            pro={pro}
            firstBonus={firstBonus}
            hole={hole}
            carryover={bean.id === 'longDrive' ? ldCarryover : bean.id === 'kp' ? kpCarryover : 0}
            onCarryover={
              bean.id === 'longDrive' ? () => dispatch({ type: 'LD_CARRYOVER' }) :
              bean.id === 'kp'        ? () => dispatch({ type: 'KP_CARRYOVER' }) :
              null
            }
            carryoverLabel={bean.id === 'kp' ? 'No one on the green' : 'No fairway'}
          />
        ))}

        {dimmedBeans.length > 0 && (
          <>
            <Text style={styles.dimLabel}>Not available — wrong par</Text>
            {dimmedBeans.map(bean => (
              <BeanCard
                key={bean.id}
                bean={bean}
                players={players}
                hasBean={() => false}
                onToggle={() => {}}
                pro={pro}
                firstBonus={firstBonus}
                hole={hole}
                dimmed
              />
            ))}
          </>
        )}
      </ScrollView>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
    </View>
  );
}

function BeanCard({ bean, players, hasBean, onToggle, pro, firstBonus, hole, dimmed, carryover = 0, onCarryover, carryoverLabel = 'No winner' }) {
  const locked = !bean.free && !pro;
  const anySelected = players.some((_, pi) => hasBean(pi));
  const effectiveValue = carryover > 0
    ? 1 + carryover
    : getEffectiveValue(bean, 0, hole, firstBonus);

  return (
    <View style={[styles.card, dimmed && styles.cardDimmed]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.beanName}>{locked ? '🔒 ' : ''}{bean.name}</Text>
          {carryover > 0 && (
            <View style={styles.carryoverBadge}>
              <Text style={styles.carryoverBadgeText}>🔄 ×{carryover + 1}</Text>
            </View>
          )}
        </View>
        <Text style={[styles.beanValue, bean.v < 0 && styles.neg]}>
          {effectiveValue > 0 ? `+${effectiveValue}` : effectiveValue} bean{Math.abs(effectiveValue) !== 1 ? 's' : ''}
          {bean.solo && !carryover ? ' · 1 winner' : ''}
        </Text>
      </View>

      <View style={styles.playerRow}>
        {players.map((name, pi) => {
          const selected = hasBean(pi);
          return (
            <TouchableOpacity
              key={pi}
              style={[styles.playerBtn, selected && (bean.v < 0 ? styles.playerBtnNeg : styles.playerBtnActive)]}
              onPress={() => onToggle(pi)}
              disabled={dimmed}
              activeOpacity={0.75}
            >
              <Text style={[styles.playerBtnText, selected && styles.playerBtnTextActive]} numberOfLines={1}>
                {name.split(' ')[0]}
              </Text>
              {selected && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {onCarryover && !anySelected && (
        <TouchableOpacity style={styles.carryoverBtn} onPress={onCarryover}>
          <Text style={styles.carryoverBtnText}>
            {carryoverLabel} — carry over {carryover > 0 ? `(now ×${carryover + 2})` : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.background },
  holeNav:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green, paddingVertical: spacing.sm },
  navBtn:     { paddingHorizontal: spacing.lg },
  navArrow:   { fontSize: 32, color: colors.white, fontWeight: '300' },
  navDisabled:{ opacity: 0.3 },
  holeCenter: { flex: 1, alignItems: 'center' },
  holeLabel:  { fontSize: 20, fontWeight: '800', color: colors.white },
  parLabel:   { fontSize: 13, color: 'rgba(255,255,255,0.75)' },

  totalsBar:  { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  totalChip:  { flex: 1, alignItems: 'center' },
  totalName:  { fontSize: 11, color: colors.textMid, fontWeight: '600' },
  totalVal:   { fontSize: 16, fontWeight: '800', color: colors.green },

  content:    { padding: spacing.md, paddingBottom: 80 },
  dimLabel:   { fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },

  card:       { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, padding: spacing.md },
  cardDimmed: { opacity: 0.4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  beanName:   { fontSize: 15, fontWeight: '700', color: colors.textDark },
  beanValue:  { fontSize: 13, color: colors.green, fontWeight: '600' },

  playerRow:  { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  playerBtn:  { flex: 1, minWidth: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.offWhite },
  playerBtnActive: { backgroundColor: colors.green, borderColor: colors.green },
  playerBtnNeg:    { backgroundColor: colors.red, borderColor: colors.red },
  playerBtnText:   { fontSize: 13, fontWeight: '600', color: colors.textMid },
  playerBtnTextActive: { color: colors.white },
  checkmark:  { fontSize: 12, color: colors.white, fontWeight: '800' },

  neg: { color: colors.red },
  carryoverBadge:     { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  carryoverBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  carryoverBtn:       { marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm, alignItems: 'center' },
  carryoverBtnText:   { color: colors.gold, fontWeight: '700', fontSize: 13 },
});
