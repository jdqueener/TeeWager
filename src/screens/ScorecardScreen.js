import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, useWindowDimensions,
  Alert, Platform, Modal, TextInput,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { isParAllowed, getEffectiveValue, beanLabel, totalBeansForPlayer, getEffectiveBeanValue } from '../utils/beans';
import { colors, spacing, radius, shadow } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';

const CELL_W  = 38;
const LABEL_W = 70;

export default function ScorecardScreen() {
  const { width: screenWidth } = useWindowDimensions();
  const { state, dispatch, pro, setPro, activeBeans, getHolePar } = useGame();
  const {
    players, scores, firstBonus, beanValue,
    currentHole, progressHole = 0, ldCarryover, kpCarryover, skinsCarryover = 0,
    holeCount = 18, holeOffset = 0, course,
    pressMode, presses = [], tenthPressed = false, tenthPressValue, holePresses = {},
    ldCarryoverEnabled = true, kpCarryoverEnabled = true,
  } = state;

  const strokes = state.strokes?.length === players.length
    ? state.strokes
    : Array.from({ length: players.length }, () => Array.from({ length: 18 }, () => 0));

  const [mode, setMode] = useState('hole'); // 'hole' | 'grid'
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [conflictPrompt, setConflictPrompt] = useState(null);
  const [pressModalVisible, setPressModalVisible] = useState(false);
  const [selectedPressPlayers, setSelectedPressPlayers] = useState([]);
  const [pressAmountModal, setPressAmountModal] = useState(null); // { mode: 'anytime'|'tenth' }
  const [customPressAmt, setCustomPressAmt] = useState('');
  const [chosenPressAmt, setChosenPressAmt] = useState(null);

  const hole = currentHole;
  const par  = getHolePar(hole);
  const lastHole = holeCount - 1;
  const isPastHole = hole < progressHole;

  // Current effective bean value at this hole
  const currentEffValue = getEffectiveBeanValue(beanValue, hole, pressMode, presses, tenthPressed, tenthPressValue);

  const showPressBtn = pressMode && (
    pressMode === 'anytime' ||
    (pressMode === 'tenth' && hole === 9 && !tenthPressed) ||
    pressMode === 'perHole'
  );

  function handlePress() {
    if (pressMode === 'anytime' || pressMode === 'tenth') {
      setChosenPressAmt(null);
      setCustomPressAmt('');
      setPressAmountModal({ mode: pressMode });
    } else if (pressMode === 'perHole') {
      setSelectedPressPlayers(holePresses[hole]?.playerIdxs ?? []);
      setChosenPressAmt(null);
      setCustomPressAmt('');
      setPressModalVisible(true);
    }
  }

  function confirmAmountPress(amount) {
    if (!amount || amount <= 0) return;
    if (pressAmountModal?.mode === 'anytime') {
      dispatch({ type: 'ADD_PRESS', holeIdx: hole, value: amount });
    } else if (pressAmountModal?.mode === 'tenth') {
      dispatch({ type: 'PRESS_TENTH', value: amount });
    }
    setPressAmountModal(null);
  }

  function confirmHolePress(amount) {
    if (selectedPressPlayers.length >= 2 && amount > 0) {
      dispatch({ type: 'ADD_HOLE_PRESS', holeIdx: hole, playerIdxs: [...selectedPressPlayers], value: amount });
    }
    setPressModalVisible(false);
  }

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
    return totalBeansForPlayer(pi, scores, activeBeans, firstBonus);
  }

  function getStroke(pi, hi) { return strokes?.[pi]?.[hi] ?? 0; }

  function advanceHole() {
    if (hole >= lastHole) return;

    const ldBean     = activeBeans.find(b => b.id === 'longDrive');
    const kpBean     = activeBeans.find(b => b.id === 'kp');
    const skinsBean  = activeBeans.find(b => b.id === 'lowBall');
    const ldEligible = ldBean && isParAllowed(ldBean, par);
    const kpEligible = kpBean && isParAllowed(kpBean, par);
    const ldWon      = players.some((_, pi) => hasBean(pi, 'longDrive'));
    const kpWon      = players.some((_, pi) => hasBean(pi, 'kp'));

    const doCarryovers = () => {
      if (ldCarryoverEnabled && ldEligible && !ldWon) dispatch({ type: 'LD_CARRYOVER', holeIdx: hole });
      if (kpCarryoverEnabled && kpEligible && !kpWon) dispatch({ type: 'KP_CARRYOVER', holeIdx: hole });
    };

    const next = () => {
      doCarryovers();
      dispatch({ type: 'SET_HOLE', hole: hole + 1 });
    };

    const holeStrokes = players.map((_, pi) => getStroke(pi, hole));
    const allEntered  = holeStrokes.every(s => s > 0);
    if (!allEntered) { next(); return; }

    const minS     = Math.min(...holeStrokes);
    const hLeaders = players.map((_, pi) => holeStrokes[pi] === minS);
    const outright = hLeaders.filter(Boolean).length === 1;
    const winner   = players.findIndex((_, pi) => hasBean(pi, 'lowBall'));

    const confirm = (title, msg) => {
      if (Platform.OS !== 'web') {
        Alert.alert(title, msg, [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Advance Anyway', onPress: next },
        ]);
      } else {
        setConflictPrompt({ title, msg, onConfirm: next });
      }
    };

    if (winner >= 0 && !hLeaders[winner]) {
      const leaderName = players[hLeaders.indexOf(true)].split(' ')[0];
      const winnerName = players[winner].split(' ')[0];
      confirm(
        'Low Ball Conflict',
        `${winnerName} is awarded Low Ball but ${leaderName} has the low score (${minS}). Advance anyway?`
      );
      return;
    }

    // No skins winner — auto-award outright winner or carry over tie
    if (winner < 0 && skinsBean) {
      if (outright) {
        dispatch({ type: 'SKINS_AWARD', playerIdx: hLeaders.indexOf(true), holeIdx: hole, totalBeans: 1 + skinsCarryover });
      } else {
        dispatch({ type: 'SKINS_CARRYOVER', holeIdx: hole });
      }
    }

    next();
  }

  function setStroke(pi, hi, val) {
    const newVal = Math.max(0, val);
    dispatch({ type: 'SET_STROKE', playerIdx: pi, holeIdx: hi, value: newVal });

    const holePar = getHolePar(hi);
    const diff = newVal > 0 ? newVal - holePar : null;

    const birdieBean = activeBeans.find(b => b.id === 'birdie');
    const eagleBean  = activeBeans.find(b => b.id === 'eagle');

    // Clear any existing auto-awarded birdie/eagle on this hole for this player
    if (birdieBean && (scores[pi]?.[hi]?.birdie || 0) > 0) {
      dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: hi, beanId: 'birdie', delta: -1, bean: birdieBean });
    }
    if (eagleBean && (scores[pi]?.[hi]?.eagle || 0) > 0) {
      dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: hi, beanId: 'eagle', delta: -1, bean: eagleBean });
    }

    // Auto-award based on new score
    if (diff === -1 && birdieBean) {
      dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: hi, beanId: 'birdie', delta: 1, bean: birdieBean });
    } else if (diff <= -2 && eagleBean) {
      dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: hi, beanId: 'eagle', delta: 1, bean: eagleBean });
    }
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
      if (b.awardToOthers) {
        // This player receives beans when other players 3-putt/4-putt
        players.forEach((_, op) => {
          if (op === pi) return;
          const c = scores[op]?.[hi]?.[b.id] || 0;
          if (c > 0) t += c * Math.abs(getEffectiveValue(b, op, hi, firstBonus));
        });
      } else {
        const c = scores[pi]?.[hi]?.[b.id] || 0;
        if (c > 0) t += c * getEffectiveValue(b, pi, hi, firstBonus);
      }
    });
    return t;
  }

  const AUTO_BEANS = new Set(['birdie', 'eagle']);
  const visibleBeans = activeBeans.filter(b => isParAllowed(b, par) && !AUTO_BEANS.has(b.id));
  const dimmedBeans  = activeBeans.filter(b => !isParAllowed(b, par) && !AUTO_BEANS.has(b.id));

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
              onPress={advanceHole}
              disabled={hole === lastHole}
              style={styles.navBtn}
            >
              <Text style={[styles.navArrow, hole === lastHole && styles.navDisabled]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Running totals */}
          <View style={styles.totalsBar}>
            {players.map((name, pi) => {
              const t = playerTotalBeans(pi) + (state.spots?.[pi] || 0);
              return (
                <View key={pi} style={styles.totalChip}>
                  <Text style={styles.totalName} numberOfLines={1}>{name.split(' ')[0]}</Text>
                  <Text style={[styles.totalVal, t < 0 && styles.neg]}>{t >= 0 ? `+${t}` : t}</Text>
                </View>
              );
            })}
          </View>

          {/* Press bar */}
          {pressMode && (
            <View style={styles.pressBar}>
              <View style={{ flex: 1 }}>
                {currentEffValue > beanValue && pressMode !== 'perHole' && (
                  <Text style={styles.pressActive}>🤝 Press active — ${currentEffValue.toFixed(2)}/bean</Text>
                )}
                {pressMode === 'perHole' && holePresses[hole] && (
                  <Text style={styles.pressActive}>
                    🤝 Press ${holePresses[hole].value?.toFixed(2)}/bean: {holePresses[hole].playerIdxs?.map(pi => players[pi]?.split(' ')[0]).join(' vs ')}
                  </Text>
                )}
              </View>
              {showPressBtn && (
                <TouchableOpacity style={styles.pressBtn} onPress={handlePress} activeOpacity={0.85}>
                  <Text style={styles.pressBtnText}>
                    {pressMode === 'anytime'
                      ? currentEffValue > beanValue ? '🤝 Press again' : '🤝 Press'
                      : pressMode === 'tenth'
                      ? '🤝 Press (back 9)'
                      : holePresses[hole] ? '🤝 Edit press' : '🤝 Press this hole'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <ScrollView contentContainerStyle={styles.holeContent}>
            {/* Stroke row */}
            <View style={styles.strokesCard}>
              <Text style={styles.strokesLabel}>Strokes</Text>
              <View style={styles.strokesRow}>
                {players.map((name, pi) => {
                  const s  = getStroke(pi, hole);
                  const bg = strokeColor(s, par);
                  // Wide screens or ≤2 players: single row. Narrow mobile with 3+: 2-column grid.
                  const useGrid = players.length >= 3 && screenWidth < 500;
                  const playerStyle = useGrid
                    ? [styles.strokePlayer, { flexBasis: '48%', flexGrow: 0 }]
                    : [styles.strokePlayer, { flex: 1 }];
                  const autoBirdieAwarded = (scores[pi]?.[hole]?.birdie || 0) > 0;
                  const autoEagleAwarded  = (scores[pi]?.[hole]?.eagle  || 0) > 0;
                  const autoLabel = autoEagleAwarded ? '🦅 Eagle' : autoBirdieAwarded ? '🐦 Birdie' : null;
                  const isFirstBirdie = autoBirdieAwarded && state.firstBonus?.birdie?.playerIdx === pi && state.firstBonus?.birdie?.holeIdx === hole;

                  return (
                    <View key={pi} style={playerStyle}>
                      <Text style={styles.strokeName} numberOfLines={1}>{name.split(' ')[0]}</Text>
                      {Platform.OS === 'web' ? (
                        <StrokePicker
                          value={s}
                          par={par}
                          onChange={val => setStroke(pi, hole, val)}
                        />
                      ) : (
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
                      )}
                      {s > 0 && (
                        <Text style={[styles.strokeDiff,
                          s - par < 0 && { color: colors.green },
                          s - par > 0 && { color: colors.red },
                        ]}>
                          {s - par === 0 ? 'E' : s - par > 0 ? `+${s - par}` : s - par}
                        </Text>
                      )}
                      {autoLabel && (
                        <Text style={styles.autoAwardLabel}>
                          {autoLabel}{isFirstBirdie ? ' ×2' : ''}
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
                    onCarryover={isPastHole ? null : () => dispatch({ type: 'SKINS_CARRYOVER', holeIdx: hole })}
                    carryover={isPastHole ? 0 : skinsCarryover}
                    anyAwarded={players.some((_, pi) => hasBean(pi, 'lowBall'))}
                    onShowConflict={(title, msg, onConfirm) => setConflictPrompt({ title, msg, onConfirm })}
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
                  carryover={isPastHole ? 0 : (bean.id === 'longDrive' ? ldCarryover : bean.id === 'kp' ? kpCarryover : 0)}
                  onCarryover={isPastHole ? null :
                    bean.id === 'longDrive' && ldCarryoverEnabled ? () => dispatch({ type: 'LD_CARRYOVER', holeIdx: hole }) :
                    bean.id === 'kp'        && kpCarryoverEnabled ? () => dispatch({ type: 'KP_CARRYOVER', holeIdx: hole }) :
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
              const earned = holes.reduce((s, hi) => s + getHoleBeans(pi, hi), 0);
              const beans  = earned + (state.spots?.[pi] || 0);
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

      {/* Per-hole press: player selection + amount */}
      <Modal visible={pressModalVisible} transparent animationType="slide">
        <View style={styles.pressModalOverlay}>
          <View style={styles.pressModalSheet}>
            <Text style={styles.pressModalTitle}>🤝 Press — Hole {holeOffset + hole + 1}</Text>
            <Text style={styles.pressModalSub}>Select players in the side bet, then set the new bean value for this hole.</Text>

            <TouchableOpacity style={styles.pressAllBtn} onPress={() => setSelectedPressPlayers(players.map((_, i) => i))} activeOpacity={0.75}>
              <Text style={styles.pressAllBtnText}>Select all</Text>
            </TouchableOpacity>

            {players.map((name, pi) => {
              const sel = selectedPressPlayers.includes(pi);
              return (
                <TouchableOpacity key={pi} style={[styles.pressPlayerRow, sel && styles.pressPlayerRowActive]}
                  onPress={() => setSelectedPressPlayers(prev => prev.includes(pi) ? prev.filter(i => i !== pi) : [...prev, pi])}
                  activeOpacity={0.75}>
                  <Text style={[styles.pressPlayerName, sel && { color: colors.white }]}>{name}</Text>
                  {sel && <Text style={styles.pressPlayerCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}

            {selectedPressPlayers.length >= 2 && (
              <PressAmountPicker
                beanValue={beanValue}
                currentValue={holePresses[hole]?.value ?? beanValue * 2}
                chosen={chosenPressAmt}
                custom={customPressAmt}
                onChoose={setChosenPressAmt}
                onCustomChange={setCustomPressAmt}
              />
            )}

            <TouchableOpacity
              style={[styles.pressConfirmBtn, (selectedPressPlayers.length < 2 || !(chosenPressAmt ?? parseFloat(customPressAmt))) && styles.pressConfirmBtnDisabled]}
              onPress={() => {
                const amt = chosenPressAmt ?? parseFloat(customPressAmt);
                confirmHolePress(amt);
              }}
              disabled={selectedPressPlayers.length < 2 || !(chosenPressAmt ?? parseFloat(customPressAmt))}
              activeOpacity={0.85}
            >
              <Text style={styles.pressConfirmText}>
                {selectedPressPlayers.length < 2 ? 'Select at least 2 players' :
                 !(chosenPressAmt ?? parseFloat(customPressAmt)) ? 'Choose new amount' :
                 `Confirm — $${(chosenPressAmt ?? parseFloat(customPressAmt)).toFixed(2)}/bean`}
              </Text>
            </TouchableOpacity>

            {holePresses[hole] && (
              <TouchableOpacity style={styles.pressCancelHoleBtn}
                onPress={() => { dispatch({ type: 'REMOVE_HOLE_PRESS', holeIdx: hole }); setPressModalVisible(false); }}
                activeOpacity={0.75}>
                <Text style={styles.pressCancelHoleText}>Remove press this hole</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => setPressModalVisible(false)} style={styles.pressDismissBtn}>
              <Text style={styles.pressDismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Anytime / tenth press: amount picker */}
      <Modal visible={!!pressAmountModal} transparent animationType="slide">
        <View style={styles.pressModalOverlay}>
          <View style={styles.pressModalSheet}>
            <Text style={styles.pressModalTitle}>
              {pressAmountModal?.mode === 'tenth' ? '🤝 Press — Back 9' : '🤝 Press'}
            </Text>
            <Text style={styles.pressModalSub}>
              {pressAmountModal?.mode === 'tenth'
                ? 'Set the new bean value for holes 10–18.'
                : 'Set the new bean value from this hole forward.'}
            </Text>
            <Text style={styles.pressCurrentLabel}>Current: ${currentEffValue.toFixed(2)}/bean</Text>

            <PressAmountPicker
              beanValue={beanValue}
              currentValue={currentEffValue * 2}
              chosen={chosenPressAmt}
              custom={customPressAmt}
              onChoose={setChosenPressAmt}
              onCustomChange={setCustomPressAmt}
            />

            <TouchableOpacity
              style={[styles.pressConfirmBtn, !(chosenPressAmt ?? parseFloat(customPressAmt)) && styles.pressConfirmBtnDisabled]}
              onPress={() => {
                const amt = chosenPressAmt ?? parseFloat(customPressAmt);
                confirmAmountPress(amt);
              }}
              disabled={!(chosenPressAmt ?? parseFloat(customPressAmt))}
              activeOpacity={0.85}
            >
              <Text style={styles.pressConfirmText}>
                {!(chosenPressAmt ?? parseFloat(customPressAmt))
                  ? 'Choose new amount'
                  : `Confirm — $${(chosenPressAmt ?? parseFloat(customPressAmt)).toFixed(2)}/bean`}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPressAmountModal(null)} style={styles.pressDismissBtn}>
              <Text style={styles.pressDismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Cross-platform conflict confirmation modal */}
      <Modal visible={!!conflictPrompt} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{conflictPrompt?.title}</Text>
            <Text style={styles.confirmMsg}>{conflictPrompt?.msg}</Text>
            <TouchableOpacity
              style={styles.confirmAdvance}
              onPress={() => { conflictPrompt?.onConfirm(); setConflictPrompt(null); }}
            >
              <Text style={styles.confirmAdvanceText}>Advance Anyway</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBack} onPress={() => setConflictPrompt(null)}>
              <Text style={styles.confirmBackText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Press amount picker ───────────────────────────────────────────────────
function PressAmountPicker({ beanValue, currentValue, chosen, custom, onChoose, onCustomChange }) {
  const multiples = [2, 3, 4, 5].map(m => parseFloat((beanValue * m).toFixed(2)));
  const unique = [...new Set(multiples)].filter(v => v !== beanValue);

  return (
    <View style={styles.pressAmtWrap}>
      <Text style={styles.pressAmtLabel}>New $ per bean</Text>
      <View style={styles.pressAmtRow}>
        {unique.map(v => (
          <TouchableOpacity key={v} style={[styles.pressAmtBtn, chosen === v && styles.pressAmtBtnActive]}
            onPress={() => { onChoose(v); onCustomChange(''); }} activeOpacity={0.75}>
            <Text style={[styles.pressAmtBtnText, chosen === v && { color: colors.white }]}>${v.toFixed(2)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={[styles.pressAmtInput, !chosen && custom && { borderColor: colors.gold }]}
        placeholder="Custom amount…"
        placeholderTextColor={colors.textLight}
        keyboardType="decimal-pad"
        value={custom}
        onChangeText={t => { onCustomChange(t); onChoose(null); }}
      />
    </View>
  );
}

// ── Stroke dropdown (web only) ────────────────────────────────────────────
function StrokePicker({ value, par, onChange }) {
  const d   = value ? value - par : null;
  const bg  = d == null ? null : d <= -2 ? '#B8860B' : d === -1 ? '#2d6a4f' : d === 1 ? '#E67E22' : d >= 2 ? '#c0392b' : null;
  const fg  = bg ? '#ffffff' : '#1a1a1a';
  const bdr = bg ? bg : '#cccccc';

  return (
    <select
      value={value || ''}
      onChange={e => onChange(parseInt(e.target.value) || 0)}
      style={{
        fontSize: 22,
        fontWeight: '800',
        color: fg,
        backgroundColor: bg || '#f5f5f5',
        border: `2px solid ${bdr}`,
        borderRadius: 10,
        padding: '10px 6px',
        width: 68,
        textAlign: 'center',
        textAlignLast: 'center',
        cursor: 'pointer',
        outline: 'none',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
      }}
    >
      <option value="">—</option>
      {Array.from({ length: 15 }, (_, i) => i + 1).map(n => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
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
        <Text style={[styles.beanValue, bean.awardToOthers && styles.neg]}>
          {beanLabel(effectiveValue, bean.awardToOthers)}{bean.solo && !carryover ? ' · 1 winner' : ''}
        </Text>
      </View>
      <View style={styles.playerRow}>
        {players.map((name, pi) => {
          const selected = hasBean(pi);
          return (
            <TouchableOpacity
              key={pi}
              style={[styles.playerBtn, selected && (bean.awardToOthers ? styles.playerBtnNeg : styles.playerBtnActive)]}
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
function LowBallCard({ bean, players, strokes, leaders, outright, hasWinner, onAward, onCarryover, carryover, anyAwarded, onShowConflict }) {
  const pot = 1 + carryover;
  const allEntered = strokes.length > 0 && strokes.every(s => s > 0);

  // No auto-award during entry — scores fire mid-entry while a player
  // taps from 0 up to their real score, causing wrong awards.
  // Instead, the correct player is auto-awarded in advanceHole() when
  // the user deliberately moves to the next hole and scores are final.

  function handleAward(pi) {
    // Warn if the tapped player's stroke is higher than the current minimum
    // among entered strokes — catches wrong taps even mid-entry.
    const enteredStrokes = strokes.filter(s => s > 0);
    const minSoFar = enteredStrokes.length > 0 ? Math.min(...enteredStrokes) : null;
    const tappedStroke = strokes[pi];
    if (tappedStroke > 0 && minSoFar !== null && tappedStroke > minSoFar) {
      const currentLeaderIdx = strokes.indexOf(minSoFar);
      const leaderName = currentLeaderIdx >= 0 ? players[currentLeaderIdx].split(' ')[0] : 'another player';
      const msg = `${players[pi].split(' ')[0]} has ${tappedStroke} strokes — ${leaderName} currently has the low score (${minSoFar}). Award Low Ball to ${players[pi].split(' ')[0]} anyway?`;
      if (Platform.OS !== 'web') {
        Alert.alert('Override Low Ball?', msg, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Award Anyway', style: 'destructive', onPress: () => onAward(pi) },
        ]);
      } else {
        onShowConflict('Override Low Ball?', msg, () => onAward(pi));
      }
      return;
    }
    onAward(pi);
  }

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
              onPress={() => won ? onAward(pi) : handleAward(pi)}
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

      {!anyAwarded && !outright && strokes.some(s => s > 0) && (
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
  root: { flex: 1, backgroundColor: colors.background },

  // Mode toggle
  modeBar:           { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border, padding: 6, gap: 4 },
  modeBtn:           { flex: 1, paddingVertical: 11, borderRadius: radius.pill, alignItems: 'center' },
  modeBtnActive:     { backgroundColor: colors.green, ...shadow.green },
  modeBtnText:       { fontSize: 14, fontWeight: '800', color: colors.textMid },
  modeBtnTextActive: { color: colors.white },

  // Hole navigation
  holeNav:     { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green, paddingVertical: 10, ...shadow.green },
  navBtn:      { paddingHorizontal: spacing.md, minWidth: 56, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  navArrow:    { fontSize: 36, color: colors.white, fontWeight: '200' },
  navDisabled: { opacity: 0.25 },
  holeCenter:  { flex: 1, alignItems: 'center', paddingVertical: 2 },
  holeLabel:   { fontSize: 25, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  parLabel:    { fontSize: 12, color: 'rgba(255,255,255,0.82)', textAlign: 'center', flexWrap: 'wrap', marginTop: 3, fontWeight: '600' },

  // Running totals bar
  totalsBar:  { flexDirection: 'row', backgroundColor: colors.white, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, gap: spacing.xs, ...shadow.sm, zIndex: 5 },
  totalChip:  { flex: 1, alignItems: 'center', backgroundColor: colors.greenPale, borderRadius: radius.sm, paddingVertical: 8, paddingHorizontal: 4 },
  totalName:  { fontSize: 10, color: colors.textMid, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalVal:   { fontSize: 22, fontWeight: '900', color: colors.green, marginTop: 2, letterSpacing: -0.5 },

  holeContent: { padding: spacing.md, paddingBottom: 120 },

  // Stroke counter
  strokesCard:   { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  strokesLabel:  { fontSize: 11, fontWeight: '800', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: spacing.sm },
  strokesRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  strokePlayer:  { alignItems: 'center', gap: 6, paddingVertical: spacing.xs },
  strokeName:    { fontSize: 12, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.3 },
  strokeCounter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  strokeBtn:     { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', ...shadow.green },
  strokeBtnText: { color: colors.white, fontSize: 24, fontWeight: '300', lineHeight: 30 },
  strokeVal:     { width: 50, height: 50, borderRadius: radius.sm, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  strokeNum:     { fontSize: 22, fontWeight: '800', color: colors.textDark },
  strokeDiff:    { fontSize: 11, fontWeight: '800', color: colors.textMid },
  autoAwardLabel:{ fontSize: 10, fontWeight: '700', color: colors.green, marginTop: 2 },

  dimLabel: { fontSize: 11, color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm, fontWeight: '700' },

  // Bean cards
  card:            { backgroundColor: colors.white, borderRadius: radius.md, marginBottom: spacing.sm, padding: spacing.md, ...shadow.sm },
  cardDimmed:      { opacity: 0.4 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  beanName:        { fontSize: 15, fontWeight: '800', color: colors.textDark },
  beanValue:       { fontSize: 13, color: colors.green, fontWeight: '700' },
  playerRow:       { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  playerBtn:       { flex: 1, minWidth: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 16, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.background },
  playerBtnActive: { backgroundColor: colors.green, borderColor: colors.green, ...shadow.green },
  playerBtnNeg:    { backgroundColor: colors.red, borderColor: colors.red },
  playerBtnText:   { fontSize: 14, fontWeight: '700', color: colors.textMid },
  playerBtnTextActive: { color: colors.white, fontWeight: '800' },
  checkmark:       { fontSize: 13, color: colors.white, fontWeight: '900' },
  neg:             { color: colors.red },

  carryoverBadge:     { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 3 },
  carryoverBadgeText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  carryoverBtn:       { marginTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border, paddingTop: spacing.sm, alignItems: 'center' },
  carryoverBtnText:   { color: colors.gold, fontWeight: '700', fontSize: 13 },
  skinsHint:          { fontSize: 12, color: colors.textMid, marginBottom: spacing.sm, fontStyle: 'italic' },
  playerBtnLeader:    { backgroundColor: '#d4edda', borderColor: colors.green },
  skinsStokeText:     { fontSize: 11, color: colors.textMid, fontWeight: '700', marginLeft: 2 },

  // Grid mode
  gridContent:       { padding: spacing.sm, paddingBottom: 80 },
  gridTitle:         { fontSize: 15, fontWeight: '800', color: colors.textDark, padding: spacing.sm, paddingBottom: 4 },
  gridCard:          { backgroundColor: colors.white, borderRadius: radius.md, marginBottom: spacing.sm, overflow: 'hidden', ...shadow.sm },
  gridRow:           { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border },
  gridRowAlt:        { backgroundColor: colors.offWhite },
  gridParRow:        { backgroundColor: '#e8f5ee' },
  gridLabel:         { width: LABEL_W, fontSize: 11, fontWeight: '700', color: colors.textDark, paddingHorizontal: spacing.xs, paddingVertical: 6 },
  gridCell:          { width: CELL_W, textAlign: 'center', fontSize: 11, paddingVertical: 6 },
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

  totalsCard:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, ...shadow.sm },
  totalsSectionLabel: { fontSize: 12, fontWeight: '800', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.sm },
  totalRow:           { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  totalName2:         { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textDark },
  totalSplit:         { fontSize: 13, color: colors.textMid, width: 32, textAlign: 'center' },
  totalScore:         { fontSize: 18, fontWeight: '900', color: colors.textDark, width: 40, textAlign: 'center' },
  totalDiff:          { fontSize: 13, fontWeight: '700', color: colors.textMid, width: 36, textAlign: 'center' },
  totalBeans:         { fontSize: 13, fontWeight: '700', color: colors.green, width: 60, textAlign: 'right' },

  // Press bar
  pressBar:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9E6', borderBottomWidth: 1, borderBottomColor: '#E8CE7A', paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.sm, minHeight: 48 },
  pressActive:  { fontSize: 13, fontWeight: '700', color: '#8B6914' },
  pressBtn:     { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 9, paddingHorizontal: spacing.md, ...shadow.gold },
  pressBtnText: { fontSize: 13, fontWeight: '800', color: colors.white },

  // Press player-pick modal
  pressModalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  pressModalSheet:    { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 44 },
  pressModalTitle:    { fontSize: 20, fontWeight: '900', color: colors.textDark, marginBottom: spacing.xs },
  pressModalSub:      { fontSize: 14, color: colors.textMid, marginBottom: spacing.md, lineHeight: 20 },
  pressAllBtn:        { borderWidth: 1.5, borderColor: colors.gold, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  pressAllBtnText:    { color: colors.gold, fontWeight: '800', fontSize: 14 },
  pressPlayerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 15, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.xs, backgroundColor: colors.background },
  pressPlayerRowActive:{ backgroundColor: colors.gold, borderColor: colors.gold },
  pressPlayerName:    { fontSize: 16, fontWeight: '700', color: colors.textDark },
  pressPlayerCheck:   { fontSize: 17, color: colors.white, fontWeight: '900' },
  pressConfirmBtn:    { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: spacing.md, ...shadow.gold },
  pressConfirmBtnDisabled: { backgroundColor: colors.border },
  pressConfirmText:   { color: colors.white, fontWeight: '800', fontSize: 15 },
  pressCancelHoleBtn: { paddingVertical: 12, alignItems: 'center' },
  pressCancelHoleText:{ color: colors.red, fontWeight: '600', fontSize: 14 },
  pressDismissBtn:    { paddingVertical: 10, alignItems: 'center' },
  pressDismissText:   { color: colors.textMid, fontWeight: '600', fontSize: 14 },
  pressCurrentLabel:  { fontSize: 13, color: colors.textMid, fontWeight: '600', marginBottom: spacing.sm },
  pressAmtWrap:       { marginTop: spacing.md },
  pressAmtLabel:      { fontSize: 12, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  pressAmtRow:        { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm, flexWrap: 'wrap' },
  pressAmtBtn:        { flex: 1, minWidth: 64, paddingVertical: 11, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.gold, alignItems: 'center', backgroundColor: colors.white },
  pressAmtBtnActive:  { backgroundColor: colors.gold },
  pressAmtBtnText:    { fontSize: 14, fontWeight: '700', color: colors.gold },
  pressAmtInput:      { borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, fontSize: 15, color: colors.textDark, marginTop: spacing.xs },

  // Conflict confirm modal
  confirmOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  confirmCard:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, width: '100%', maxWidth: 360 },
  confirmTitle:        { fontSize: 17, fontWeight: '800', color: colors.textDark, marginBottom: spacing.xs },
  confirmMsg:          { fontSize: 14, color: colors.textMid, marginBottom: spacing.lg, lineHeight: 20 },
  confirmAdvance:      { backgroundColor: colors.red, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginBottom: spacing.sm },
  confirmAdvanceText:  { color: colors.white, fontWeight: '700', fontSize: 15 },
  confirmBack:         { paddingVertical: 12, alignItems: 'center' },
  confirmBackText:     { color: colors.textMid, fontSize: 15, fontWeight: '600' },
});
