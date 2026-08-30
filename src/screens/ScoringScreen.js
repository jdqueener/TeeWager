// v2
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useGame } from '../context/GameContext';
import { isParAllowed, getEffectiveValue, beanLabel } from '../utils/beans';
import { nassauMatchSummary, legMatchStatus } from '../utils/nassau';
import { colors, spacing, radius } from '../utils/theme';
import PaywallModal from '../components/PaywallModal';
import ProBanner from '../components/ProBanner';

export default function ScoringScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const { players, scores, firstBonus, currentHole, progressHole = 0, ldCarryover, kpCarryover, skinsCarryover, holeCount = 18, holeOffset = 0, ldCarryoverEnabled = true, kpCarryoverEnabled = true, gameMode = 'beans' } = state;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const hole = currentHole;
  const lastHole = holeCount - 1;
  const par  = getHolePar(hole);

  // Detect low-ball tie from stroke counts on this hole
  const holeStrokes = players.map((_, pi) => state.strokes[pi]?.[hole] || 0);
  const validStrokes = holeStrokes.filter(s => s > 0);
  const minStroke = validStrokes.length > 0 ? Math.min(...validStrokes) : null;
  const lowBallTied = minStroke !== null && holeStrokes.filter(s => s === minStroke).length >= 2;

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
      for (let h = 0; h < holeCount; h++) {
        const count = scores[pi]?.[h]?.[bean.id] || 0;
        t += count * getEffectiveValue(bean, pi, h, firstBonus);
      }
    });
    return t;
  }

  const AUTO_BEANS = new Set(['birdie', 'eagle']);
  const visibleBeans = activeBeans.filter(b => isParAllowed(b, par) && !AUTO_BEANS.has(b.id));
  const dimmedBeans  = activeBeans.filter(b => !isParAllowed(b, par) && !AUTO_BEANS.has(b.id));

  const isPastHole = hole < progressHole;

  function advanceHole() {
    if (hole >= lastHole) return;

    // Auto-carryover — reducer deduplicates by holeIdx so back/forward is safe
    if (ldCarryoverEnabled && visibleBeans.find(b => b.id === 'longDrive') && !players.some((_, pi) => hasBean(pi, 'longDrive'))) {
      dispatch({ type: 'LD_CARRYOVER', holeIdx: hole });
    }
    if (kpCarryoverEnabled && visibleBeans.find(b => b.id === 'kp') && !players.some((_, pi) => hasBean(pi, 'kp'))) {
      dispatch({ type: 'KP_CARRYOVER', holeIdx: hole });
    }
    if (activeBeans.find(b => b.id === 'lowBall') && lowBallTied && !players.some((_, pi) => hasBean(pi, 'lowBall'))) {
      dispatch({ type: 'SKINS_CARRYOVER', holeIdx: hole });
    }

    dispatch({ type: 'SET_HOLE', hole: hole + 1 });
  }

  if (gameMode === 'nassau') {
    return <NassauScoring state={state} dispatch={dispatch} pro={pro} setPro={setPro} getHolePar={getHolePar} />;
  }

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} />

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
          <Text style={styles.holeLabel}>Hole {holeOffset + hole + 1}</Text>
          <Text style={styles.parLabel}>
            Par {par}
            {state.course?.holes?.[holeOffset + hole]?.yardage ? ` · ${state.course.holes[holeOffset + hole].yardage}y` : ''}
          </Text>
        </View>
        <TouchableOpacity
          onPress={advanceHole}
          disabled={hole === lastHole}
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
            carryover={isPastHole ? 0 : (bean.id === 'longDrive' ? ldCarryover : bean.id === 'kp' ? kpCarryover : bean.id === 'lowBall' ? skinsCarryover : 0)}
            onCarryover={isPastHole ? null :
              bean.id === 'longDrive' && ldCarryoverEnabled ? () => dispatch({ type: 'LD_CARRYOVER', holeIdx: hole }) :
              bean.id === 'kp'        && kpCarryoverEnabled ? () => dispatch({ type: 'KP_CARRYOVER', holeIdx: hole }) :
              null
            }
            carryoverLabel={bean.id === 'kp' ? 'No one on the green' : 'No fairway'}
            isTied={bean.id === 'lowBall' ? lowBallTied : false}
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

// ─── Nassau Scoring ──────────────────────────────────────────────────────────

function NassauScoring({ state, dispatch, pro, setPro, getHolePar }) {
  const { players, strokes, currentHole, holeCount = 18, holeOffset = 0, nassauStake = 5 } = state;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const hole     = currentHole;
  const lastHole = holeCount - 1;
  const par      = getHolePar(hole);

  const playerIdxs = players.map((_, i) => i);
  const frontRange = Array.from({ length: 9 }, (_, i) => i);
  const backRange  = holeCount >= 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [];

  function statusLine(range, label) {
    if (players.length === 2) {
      return legMatchStatus(strokes, playerIdxs, range, players);
    }
    // 3-4 players: show sorted win counts
    const { wins } = nassauMatchSummary(strokes, players, holeCount)[label] || {};
    if (!wins) return 'Not started';
    const sorted = [...playerIdxs].sort((a, b) => (wins[b] || 0) - (wins[a] || 0));
    return sorted.map(pi => `${players[pi].split(' ')[0]} ${wins[pi] || 0}W`).join(' · ');
  }

  const legs = [
    { label: 'front', range: frontRange, title: 'Front 9' },
    ...(holeCount >= 18 ? [{ label: 'back', range: backRange, title: 'Back 9' }] : []),
    { label: 'total', range: Array.from({ length: holeCount }, (_, i) => i), title: 'Total' },
  ];

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} />

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
          <Text style={styles.holeLabel}>Hole {holeOffset + hole + 1}</Text>
          <Text style={styles.parLabel}>Par {par}</Text>
        </View>
        <TouchableOpacity
          onPress={() => hole < lastHole && dispatch({ type: 'SET_HOLE', hole: hole + 1 })}
          disabled={hole === lastHole}
          style={styles.navBtn}
        >
          <Text style={[styles.navArrow, hole === lastHole && styles.navDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Match status bar */}
      <View style={styles.nassauStatusBar}>
        {legs.map(leg => (
          <View key={leg.label} style={styles.nassauLeg}>
            <Text style={styles.nassauLegTitle}>{leg.title}</Text>
            <Text style={styles.nassauLegStatus} numberOfLines={1}>
              {statusLine(leg.range, leg.label)}
            </Text>
          </View>
        ))}
      </View>

      {/* Stroke entry */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.nassauHoleLabel}>Enter strokes — Hole {holeOffset + hole + 1}</Text>
        {players.map((name, pi) => {
          const val = strokes[pi]?.[hole] || 0;
          return (
            <View key={pi} style={styles.nassauStrokeRow}>
              <Text style={styles.nassauPlayerName} numberOfLines={1}>{name}</Text>
              <View style={styles.nassauStepper}>
                <TouchableOpacity
                  style={styles.nassauStepBtn}
                  onPress={() => dispatch({ type: 'SET_STROKE', playerIdx: pi, holeIdx: hole, value: Math.max(1, val - 1) })}
                  activeOpacity={0.75}
                >
                  <Text style={styles.nassauStepText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.nassauStrokeVal}>{val || '—'}</Text>
                <TouchableOpacity
                  style={styles.nassauStepBtn}
                  onPress={() => dispatch({ type: 'SET_STROKE', playerIdx: pi, holeIdx: hole, value: val + 1 })}
                  activeOpacity={0.75}
                >
                  <Text style={styles.nassauStepText}>+</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.nassauRelPar, val === 0 && { opacity: 0 }]}>
                {val === 0 ? '—' : val === par ? 'E' : val < par ? `${val - par}` : `+${val - par}`}
              </Text>
            </View>
          );
        })}

        <Text style={styles.nassauStakeNote}>
          ${nassauStake.toFixed(2)} per leg · Max ${(nassauStake * (holeCount >= 18 ? 3 : 1)).toFixed(2)} at stake
        </Text>
      </ScrollView>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
    </View>
  );
}

function BeanCard({ bean, players, hasBean, onToggle, pro, firstBonus, hole, dimmed, carryover = 0, onCarryover, carryoverLabel = 'No winner', isTied = false }) {
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
          {beanLabel(effectiveValue)}{bean.solo && !carryover ? ' · 1 winner' : ''}
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

      {onCarryover && !anySelected && !isTied && (
        <TouchableOpacity style={styles.carryoverBtn} onPress={onCarryover}>
          <Text style={styles.carryoverBtnText}>
            {carryoverLabel} — carry over {carryover > 0 ? `(now ×${carryover + 2})` : ''}
          </Text>
        </TouchableOpacity>
      )}
      {isTied && !anySelected && (
        <View style={styles.tieIndicator}>
          <Text style={styles.tieBadgeText}>🤝 Tied — carries over automatically</Text>
        </View>
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
  tieIndicator:  { marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm, alignItems: 'center' },
  tieBadgeText:  { color: colors.gold, fontWeight: '700', fontSize: 13 },
  carryoverBadge:     { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  carryoverBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  carryoverBtn:       { marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm, alignItems: 'center' },
  carryoverBtnText:   { color: colors.gold, fontWeight: '700', fontSize: 13 },

  // Nassau
  nassauStatusBar:    { flexDirection: 'row', backgroundColor: colors.green, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  nassauLeg:          { flex: 1, alignItems: 'center' },
  nassauLegTitle:     { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  nassauLegStatus:    { fontSize: 12, fontWeight: '700', color: colors.white, textAlign: 'center' },

  nassauHoleLabel:    { fontSize: 13, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  nassauStrokeRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  nassauPlayerName:   { flex: 1, fontSize: 16, fontWeight: '700', color: colors.textDark },
  nassauStepper:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nassauStepBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  nassauStepText:     { fontSize: 20, fontWeight: '300', color: colors.textDark, lineHeight: 24 },
  nassauStrokeVal:    { fontSize: 22, fontWeight: '900', color: colors.textDark, minWidth: 32, textAlign: 'center' },
  nassauRelPar:       { fontSize: 14, fontWeight: '700', color: colors.textMid, minWidth: 28, textAlign: 'right', marginLeft: spacing.sm },
  nassauStakeNote:    { fontSize: 12, color: colors.textLight, textAlign: 'center', marginTop: spacing.md },
});
