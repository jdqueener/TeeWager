import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { isParAllowed, getEffectiveValue, beanLabel } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';

const CELL_W  = 38;
const LABEL_W = 70;

export default function ScorecardScreen() {
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const {
    players, scores, firstBonus, beanValue,
    currentHole, ldCarryover, kpCarryover, skinsCarryover = 0,
    holeCount = 18, holeOffset = 0, course,
  } = state;

  const strokes = state.strokes?.length === players.length
    ? state.strokes
    : Array.from({ length: players.length }, () => Array.from({ length: 18 }, () => 0));

  const [mode, setMode] = useState('hole'); // 'hole' | 'grid'
  const [paywallVisible, setPaywallVisible] = useState(false);

  const hole = currentHole;
  const par  = getHolePar(hole);
  const lastHole = holeCount - 1;

  // ── bean helpers (same logic as ScoringScreen) ───────────────────────────
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
    } else if (bean.id === 'lowBall') {
      if (!currently) {
        dispatch({ type: 'SKINS_AWARD', playerIdx, holeIdx: hole, totalBeans: 1 + skinsCarryover });
      } else {
        const awarded = scores[playerIdx]?.[hole]?.lowBall || 1;
        dispatch({ type: 'SKINS_AWARD', playerIdx: -1, holeIdx: hole, totalBeans: 0 });
        if (awarded > 1) dispatch({ type: 'SKINS_RESTORE_CARRYOVER', value: awarded - 1 });
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

  function getStroke(pi, hi) { return strokes?.[pi]?.[hi] ?? 0; }

  function setStroke(pi, hi, val) {
    dispatch({ type: 'SET_STROKE', playerIdx: pi, holeIdx: hi, value: Math.max(0, val) });
  }

  function strokeColor(s, p) {
    if (!s) return null;
    const d = s - p;
    if (d <= -2) return '#B8860B';
    if (d === -1) return colors.green;
    if (d === 1)  return '#E67E22';
    if (d >= 2)   return colors.red;
    return null;
  }

  // ── grid helpers ─────────────────────────────────────────────────────────
  const holes = Array.from({ length: holeCount }, (_, i) => i);
  const front = holes.slice(0, Math.min(9, holeCount));
  const back  = holeCount > 9 ? holes.slice(9) : [];

  function sumStrokes(pi, holeArr) {
    return holeArr.reduce((s, hi) => s + (getStroke(pi, hi) || 0), 0);
  }
  function sumPar(holeArr) {
    return holeArr.reduce((s, hi) => s + getHolePar(hi), 0);
  }
  function getHoleBeans(pi, hi) {
    let t = 0;
    activeBeans.forEach(b => {
      const c = scores[pi]?.[hi]?.[b.id] || 0;
      if (c > 0) t += c * getEffectiveValue(b, pi, hi, firstBonus);
    });
    return t;
  }

  const visibleBeans = activeBeans.filter(b => isParAllowed(b, par));
  const dimmedBeans  = activeBeans.filter(b => !isParAllowed(b, par));

  const courseName = course?.name ?? '';
  const teeLabel   = course?.tee ? ` · ${course.tee}` : '';

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />

      {/* Mode toggle */}
      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'hole' && styles.modeBtnActive]}
          onPress={() => setMode('hole')}
        >
          <Text style={[styles.modeBtnText, mode === 'hole' && styles.modeBtnTextActive]}>⛳ Hole</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, mode === 'grid' && styles.modeBtnActive]}
          onPress={() => setMode('grid')}
        >
          <Text style={[styles.modeBtnText, mode === 'grid' && styles.modeBtnTextActive]}>📋 Scorecard</Text>
        </TouchableOpacity>
      </View>

      {mode === 'hole' ? (
        <>
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
                Par {par}{course?.holes?.[holeOffset + hole]?.yardage ? ` · ${course.holes[holeOffset + hole].yardage}y` : ''}{course?.holes?.[holeOffset + hole]?.handicap ? ` · HCP ${course.holes[holeOffset + hole].handicap}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => dispatch({ type: 'SET_HOLE', hole: Math.min(lastHole, hole + 1) })}
              disabled={hole === lastHole}
              style={styles.navBtn}
            >
              <Text style={[styles.navArrow, hole === lastHole && styles.navDisabled]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Running totals */}
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

          <ScrollView contentContainerStyle={styles.holeContent}>
            {/* Stroke row */}
            <View style={styles.strokesCard}>
              <Text style={styles.strokesLabel}>Strokes</Text>
              <View style={styles.strokesRow}>
                {players.map((name, pi) => {
                  const s  = getStroke(pi, hole);
                  const bg = strokeColor(s, par);
                  return (
                    <View key={pi} style={styles.strokePlayer}>
                      <Text style={styles.strokeName} numberOfLines={1}>{name.split(' ')[0]}</Text>
                      <View style={styles.strokeCounter}>
                        <TouchableOpacity style={styles.strokeBtn} onPress={() => setStroke(pi, hole, s - 1)}>
                          <Text style={styles.strokeBtnText}>−</Text>
                        </TouchableOpacity>
                        <View style={[styles.strokeVal, bg && { backgroundColor: bg }]}>
                          <Text style={[styles.strokeNum, bg && { color: colors.white }]}>{s || '—'}</Text>
                        </View>
                        <TouchableOpacity style={styles.strokeBtn} onPress={() => setStroke(pi, hole, s + 1)}>
                          <Text style={styles.strokeBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>
                      {s > 0 && (
                        <Text style={[styles.strokeDiff,
                          s - par < 0 && { color: colors.green },
                          s - par > 0 && { color: colors.red },
                        ]}>
                          {s - par === 0 ? 'E' : s - par > 0 ? `+${s - par}` : s - par}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Bean cards */}
            {visibleBeans.map(bean => {
              if (bean.id === 'lowBall') {
                // Auto-detect low scorer from strokes
                const holeStrokes = players.map((_, pi) => getStroke(pi, hole));
                const entered = holeStrokes.filter(s => s > 0);
                const minS = entered.length > 0 ? Math.min(...entered) : null;
                const leaders = minS != null ? players.map((_, pi) => holeStrokes[pi] === minS && holeStrokes[pi] > 0) : players.map(() => false);
                const outright = leaders.filter(Boolean).length === 1;
                return (
                  <LowBallCard
                    key="lowBall"
                    bean={bean}
                    players={players}
                    strokes={holeStrokes}
                    leaders={leaders}
                    outright={outright}
                    hasWinner={pi => hasBean(pi, 'lowBall')}
                    onAward={pi => togglePlayer(bean, pi)}
                    onCarryover={() => dispatch({ type: 'SKINS_CARRYOVER' })}
                    carryover={skinsCarryover}
                    anyAwarded={players.some((_, pi) => hasBean(pi, 'lowBall'))}
                  />
                );
              }
              return (
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
              );
            })}

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
        </>
      ) : (
        /* ── GRID MODE ────────────────────────────────────────────────── */
        <ScrollView contentContainerStyle={styles.gridContent}>
          {courseName ? (
            <Text style={styles.gridTitle}>{courseName}{teeLabel}</Text>
          ) : null}

          <GridHalf label="OUT" holes={front} players={players} holeOffset={holeOffset}
            getHolePar={getHolePar} getStroke={getStroke} getHoleBeans={getHoleBeans}
            strokeColor={strokeColor} sumStrokes={sumStrokes} sumPar={sumPar} course={course} />

          {back.length > 0 && (
            <GridHalf label="IN" holes={back} players={players} holeOffset={holeOffset}
              getHolePar={getHolePar} getStroke={getStroke} getHoleBeans={getHoleBeans}
              strokeColor={strokeColor} sumStrokes={sumStrokes} sumPar={sumPar} course={course} />
          )}

          {/* Totals */}
          <View style={styles.totalsCard}>
            <Text style={styles.totalsSectionLabel}>Totals</Text>
            {players.map((name, pi) => {
              const outS  = sumStrokes(pi, front);
              const inS   = back.length > 0 ? sumStrokes(pi, back) : 0;
              const tot   = outS + inS;
              const totP  = sumPar(front) + (back.length > 0 ? sumPar(back) : 0);
              const diff  = tot > 0 ? tot - totP : null;
              const beans = holes.reduce((s, hi) => s + getHoleBeans(pi, hi), 0);
              return (
                <View key={pi} style={styles.totalRow}>
                  <Text style={styles.totalName2}>{name}</Text>
                  {back.length > 0 && (
                    <>
                      <Text style={styles.totalSplit}>{outS || '-'}</Text>
                      <Text style={styles.totalSplit}>{inS || '-'}</Text>
                    </>
                  )}
                  <Text style={styles.totalScore}>{tot || '-'}</Text>
                  <Text style={[styles.totalDiff,
                    diff != null && diff < 0 && { color: colors.green },
                    diff != null && diff > 0 && { color: colors.red },
                  ]}>
                    {diff == null ? '' : diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`}
                  </Text>
                  <Text style={[styles.totalBeans, beans < 0 && { color: colors.red }]}>
                    {beans >= 0 ? `+${beans}` : beans} 🫘
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
    </View>
  );
}

// ── BeanCard (same as ScoringScreen) ───────────────────────────────────────
function BeanCard({ bean, players, hasBean, onToggle, pro, firstBonus, hole, dimmed, carryover = 0, onCarryover, carryoverLabel = 'No winner' }) {
  const locked = !bean.free && !pro;
  const anySelected = players.some((_, pi) => hasBean(pi));
  const effectiveValue = carryover > 0 ? 1 + carryover : getEffectiveValue(bean, 0, hole, firstBonus);

  return (
    <View style={[styles.card, dimmed && styles.cardDimmed]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.beanName}>{locked ? '🔒 ' : ''}{bean.name}</Text>
          {carryover > 0 && (
            <View style={styles.carryoverBadge}>
              <Text style={styles.carryoverBadgeText}>×{carryover + 1}</Text>
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

// ── Low Ball / Skins card ─────────────────────────────────────────────────
function LowBallCard({ bean, players, strokes, leaders, outright, hasWinner, onAward, onCarryover, carryover, anyAwarded }) {
  const pot = 1 + carryover;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={styles.beanName}>Low Ball</Text>
          {carryover > 0 && (
            <View style={styles.carryoverBadge}>
              <Text style={styles.carryoverBadgeText}>×{pot}</Text>
            </View>
          )}
        </View>
        <Text style={styles.beanValue}>
          {pot === 1 ? 'earns 1 bean · 1 winner' : `earns ${pot} beans · 1 winner`}
        </Text>
      </View>

      {/* Status hint */}
      {!anyAwarded && strokes.some(s => s > 0) && (
        <Text style={[styles.skinsHint, outright && { color: colors.green }]}>
          {outright
            ? `${players[leaders.indexOf(true)].split(' ')[0]} leads — tap to award`
            : 'Tied — award or carry over'}
        </Text>
      )}

      {/* Player buttons with stroke count */}
      <View style={styles.playerRow}>
        {players.map((name, pi) => {
          const won    = hasWinner(pi);
          const leader = leaders[pi] && !won && !anyAwarded;
          return (
            <TouchableOpacity
              key={pi}
              style={[styles.playerBtn, won && styles.playerBtnActive, leader && styles.playerBtnLeader]}
              onPress={() => onAward(pi)}
              activeOpacity={0.75}
            >
              <Text style={[styles.playerBtnText, (won || leader) && styles.playerBtnTextActive]} numberOfLines={1}>
                {name.split(' ')[0]}
              </Text>
              {strokes[pi] > 0 && (
                <Text style={[styles.skinsStokeText, (won || leader) && { color: 'rgba(255,255,255,0.85)' }]}>
                  {strokes[pi]}
                </Text>
              )}
              {won && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {!anyAwarded && (
        <TouchableOpacity style={styles.carryoverBtn} onPress={onCarryover}>
          <Text style={styles.carryoverBtnText}>
            Tie — carry over {carryover > 0 ? `(now ×${pot + 1})` : ''}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Grid half (front 9 / back 9) ───────────────────────────────────────────
function GridHalf({ label, holes, players, holeOffset, getHolePar, getStroke, getHoleBeans, strokeColor, sumStrokes, sumPar, course }) {
  return (
    <View style={styles.gridCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.gridRow}>
            <Text style={[styles.gridLabel, styles.gridHeaderCell]}>HOLE</Text>
            {holes.map(hi => <Text key={hi} style={[styles.gridCell, styles.gridHeaderCell]}>{holeOffset + hi + 1}</Text>)}
            <Text style={[styles.gridTotalCell, styles.gridHeaderCell]}>{label}</Text>
          </View>
          {course?.holes && (
            <View style={styles.gridRow}>
              <Text style={[styles.gridLabel, styles.gridInfoCell]}>YDS</Text>
              {holes.map(hi => <Text key={hi} style={[styles.gridCell, styles.gridInfoCell]}>{course.holes[holeOffset + hi]?.yardage || '-'}</Text>)}
              <Text style={[styles.gridTotalCell, styles.gridInfoCell]}>{holes.reduce((s, hi) => s + (course.holes[holeOffset + hi]?.yardage || 0), 0)}</Text>
            </View>
          )}
          {course?.holes && (
            <View style={styles.gridRow}>
              <Text style={[styles.gridLabel, styles.gridInfoCell]}>HCP</Text>
              {holes.map(hi => <Text key={hi} style={[styles.gridCell, styles.gridInfoCell]}>{course.holes[holeOffset + hi]?.handicap || '-'}</Text>)}
              <Text style={[styles.gridTotalCell, styles.gridInfoCell]}></Text>
            </View>
          )}
          <View style={[styles.gridRow, styles.gridParRow]}>
            <Text style={[styles.gridLabel, styles.gridParCell]}>PAR</Text>
            {holes.map(hi => <Text key={hi} style={[styles.gridCell, styles.gridParCell]}>{getHolePar(hi)}</Text>)}
            <Text style={[styles.gridTotalCell, styles.gridParCell]}>{sumPar(holes)}</Text>
          </View>
          {players.map((name, pi) => {
            const total = sumStrokes(pi, holes);
            const par   = sumPar(holes);
            return (
              <View key={pi} style={[styles.gridRow, pi % 2 === 1 && styles.gridRowAlt]}>
                <Text style={styles.gridLabel} numberOfLines={1}>{name}</Text>
                {holes.map(hi => {
                  const s  = getStroke(pi, hi);
                  const p  = getHolePar(hi);
                  const bg = strokeColor(s, p);
                  const beans = getHoleBeans(pi, hi);
                  return (
                    <View key={hi} style={[styles.gridScoreCell, bg && { backgroundColor: bg }]}>
                      <Text style={[styles.gridScoreText, bg && { color: colors.white }]}>{s || '-'}</Text>
                      {beans !== 0 && <Text style={styles.gridBeanDot}>{beans > 0 ? `+${beans}` : beans}</Text>}
                    </View>
                  );
                })}
                <View style={styles.gridScoreTotalCell}>
                  <Text style={styles.gridScoreTotalText}>{total || '-'}</Text>
                  {total > 0 && (
                    <Text style={[styles.gridDiffText,
                      total - par < 0 && { color: colors.green },
                      total - par > 0 && { color: colors.red },
                    ]}>
                      {total - par === 0 ? 'E' : total - par > 0 ? `+${total - par}` : total - par}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.background },

  modeBar:  { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border, padding: spacing.xs },
  modeBtn:  { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  modeBtnActive: { backgroundColor: colors.green },
  modeBtnText:   { fontSize: 14, fontWeight: '700', color: colors.textMid },
  modeBtnTextActive: { color: colors.white },

  // Hole mode
  holeNav:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green, paddingVertical: spacing.sm },
  navBtn:     { paddingHorizontal: spacing.md, minWidth: 44, alignItems: 'center' },
  navArrow:   { fontSize: 32, color: colors.white, fontWeight: '300' },
  navDisabled:{ opacity: 0.3 },
  holeCenter: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  holeLabel:  { fontSize: 20, fontWeight: '800', color: colors.white },
  parLabel:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', textAlign: 'center', flexWrap: 'wrap' },

  totalsBar:  { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm },
  totalChip:  { flex: 1, alignItems: 'center' },
  totalName:  { fontSize: 11, color: colors.textMid, fontWeight: '600' },
  totalVal:   { fontSize: 16, fontWeight: '800', color: colors.green },

  holeContent: { padding: spacing.md, paddingBottom: 100 },

  strokesCard:  { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  strokesLabel: { fontSize: 11, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  strokesRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  strokePlayer: { flexBasis: '45%', flexGrow: 1, alignItems: 'center', gap: 4, paddingVertical: spacing.xs },
  strokeName:   { fontSize: 12, fontWeight: '700', color: colors.textMid },
  strokeCounter:{ flexDirection: 'row', alignItems: 'center', gap: 8 },
  strokeBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  strokeBtnText:{ color: colors.white, fontSize: 22, fontWeight: '300', lineHeight: 28 },
  strokeVal:    { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.offWhite, justifyContent: 'center', alignItems: 'center' },
  strokeNum:    { fontSize: 20, fontWeight: '800', color: colors.textDark },
  strokeDiff:   { fontSize: 11, fontWeight: '700', color: colors.textMid },

  dimLabel:   { fontSize: 12, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm },

  card:       { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, padding: spacing.md },
  cardDimmed: { opacity: 0.4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  beanName:   { fontSize: 15, fontWeight: '700', color: colors.textDark },
  beanValue:  { fontSize: 13, color: colors.green, fontWeight: '600' },
  playerRow:  { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  playerBtn:  { flex: 1, minWidth: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 13, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.offWhite },
  playerBtnActive: { backgroundColor: colors.green, borderColor: colors.green },
  playerBtnNeg:    { backgroundColor: colors.red, borderColor: colors.red },
  playerBtnText:   { fontSize: 13, fontWeight: '600', color: colors.textMid },
  playerBtnTextActive: { color: colors.white },
  checkmark:  { fontSize: 12, color: colors.white, fontWeight: '800' },
  neg:        { color: colors.red },
  carryoverBadge:     { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  carryoverBadgeText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  carryoverBtn:       { marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm, alignItems: 'center' },
  carryoverBtnText:   { color: colors.gold, fontWeight: '700', fontSize: 13 },
  skinsHint:          { fontSize: 12, color: colors.textMid, marginBottom: spacing.sm, fontStyle: 'italic' },
  playerBtnLeader:    { backgroundColor: '#d4edda', borderColor: colors.green },
  skinsStokeText:     { fontSize: 11, color: colors.textMid, fontWeight: '700', marginLeft: 2 },

  // Grid mode
  gridContent: { padding: spacing.sm, paddingBottom: 80 },
  gridTitle:   { fontSize: 15, fontWeight: '800', color: colors.textDark, padding: spacing.sm, paddingBottom: 4 },
  gridCard:    { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden' },
  gridRow:     { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border },
  gridRowAlt:  { backgroundColor: colors.offWhite },
  gridParRow:  { backgroundColor: '#e8f5ee' },
  gridLabel:   { width: LABEL_W, fontSize: 11, fontWeight: '700', color: colors.textDark, paddingHorizontal: spacing.xs, paddingVertical: 6 },
  gridCell:    { width: CELL_W, textAlign: 'center', fontSize: 11, paddingVertical: 6 },
  gridTotalCell:     { width: CELL_W + 6, textAlign: 'center', fontSize: 11, fontWeight: '800', paddingVertical: 6 },
  gridHeaderCell:    { color: colors.white, backgroundColor: colors.green, fontWeight: '800', fontSize: 11 },
  gridInfoCell:      { color: colors.textMid, fontSize: 10 },
  gridParCell:       { color: colors.green, fontWeight: '800', fontSize: 12 },
  gridScoreCell:     { width: CELL_W, alignItems: 'center', paddingVertical: 4, borderRightWidth: 0.5, borderRightColor: colors.border },
  gridScoreText:     { fontSize: 13, fontWeight: '700', color: colors.textDark },
  gridBeanDot:       { fontSize: 8, color: colors.gold, fontWeight: '700' },
  gridScoreTotalCell:{ width: CELL_W + 6, alignItems: 'center', paddingVertical: 4, borderLeftWidth: 1, borderLeftColor: colors.border },
  gridScoreTotalText:{ fontSize: 14, fontWeight: '800', color: colors.textDark },
  gridDiffText:      { fontSize: 9, fontWeight: '700', color: colors.textMid },

  totalsCard:        { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md },
  totalsSectionLabel:{ fontSize: 13, fontWeight: '800', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  totalRow:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  totalName2:        { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textDark },
  totalSplit:        { fontSize: 13, color: colors.textMid, width: 32, textAlign: 'center' },
  totalScore:        { fontSize: 18, fontWeight: '900', color: colors.textDark, width: 40, textAlign: 'center' },
  totalDiff:         { fontSize: 13, fontWeight: '700', color: colors.textMid, width: 36, textAlign: 'center' },
  totalBeans:        { fontSize: 13, fontWeight: '700', color: colors.green, width: 60, textAlign: 'right' },
});
