import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Modal, Alert } from 'react-native';
import { useGame } from '../context/GameContext';
import { totalBeansForPlayer, computeSettleUp } from '../utils/beans';
import { saveStats, loadStats } from '../utils/storage';
import { colors, spacing, radius } from '../utils/theme';
import ProBanner from '../components/ProBanner';
import PaywallModal from '../components/PaywallModal';
import ShareCard from '../components/ShareCard';

export default function SettleUpScreen() {
  const { state, dispatch, pro, setPro, activeBeans } = useGame();
  const { players, scores, firstBonus, beanValue, wagers, course, ldCarryover, kpCarryover, holeCount = 18 } = state;
  const lastHole = holeCount - 1;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const needsChipOff = ldCarryover > 0 || kpCarryover > 0;

  function awardChipOff(type, playerIdx) {
    if (type === 'ld') {
      dispatch({ type: 'LD_AWARD_WITH_CARRYOVER', playerIdx, holeIdx: lastHole, totalBeans: 1 + ldCarryover });
    } else {
      dispatch({ type: 'KP_AWARD_WITH_CARRYOVER', playerIdx, holeIdx: lastHole, totalBeans: 1 + kpCarryover });
    }
  }

  function voidCarryovers() {
    if (ldCarryover > 0) dispatch({ type: 'LD_AWARD_WITH_CARRYOVER', playerIdx: -1, holeIdx: lastHole, totalBeans: 0 });
    if (kpCarryover > 0) dispatch({ type: 'KP_AWARD_WITH_CARRYOVER', playerIdx: -1, holeIdx: lastHole, totalBeans: 0 });
  }

  const beanTotals = players.map((_, i) => totalBeansForPlayer(i, scores, activeBeans, firstBonus));
  const payments   = computeSettleUp(players, beanTotals, beanValue, wagers);

  async function saveToStats() {
    if (!pro) { setPaywallVisible(true); return; }
    const stats = await loadStats();
    const date  = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const maxBeans = Math.max(...beanTotals);
    players.forEach((name, i) => {
      const t   = beanTotals[i];
      const won = t === maxBeans; // first-place tie counts as a win for all tied
      const prev = stats[name] || { rounds: 0, wins: 0, totalBeans: 0, totalDollars: 0, bestRoundBeans: -Infinity, bestRound: null };
      stats[name] = {
        rounds:         prev.rounds + 1,
        wins:           (prev.wins || 0) + (won ? 1 : 0),
        totalBeans:     prev.totalBeans + t,
        totalDollars:   prev.totalDollars + t * beanValue,
        bestRound:      t > (prev.bestRoundBeans ?? -Infinity) ? date : prev.bestRound,
        bestRoundBeans: Math.max(prev.bestRoundBeans ?? -Infinity, t),
      };
    });
    await saveStats(stats);
    setSaved(true);
    if (Platform.OS !== 'web') {
      Alert.alert('Saved!', 'Lifetime stats updated for all players.');
    }
  }

  function newRound() {
    if (Platform.OS === 'web') {
      setConfirmVisible(true);
    } else {
      Alert.alert('Start new round?', 'This will clear all scoring data.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'New Round', style: 'destructive', onPress: () => dispatch({ type: 'RESET' }) },
      ]);
    }
  }

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} onReset={() => dispatch({ type: 'RESET' })} onSetPro={setPro} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Settle Up</Text>

        {/* Chip-Off */}
        {needsChipOff && (
          <>
            <Text style={styles.sectionLabel}>⛳ Chip-Off Required</Text>
            <View style={styles.chipOffCard}>
              <Text style={styles.chipOffTitle}>Unawarded carryover beans — select the chip-off winner</Text>

              {ldCarryover > 0 && (
                <View style={styles.chipOffRow}>
                  <Text style={styles.chipOffLabel}>Long Drive · ×{ldCarryover + 1} beans</Text>
                  <View style={styles.chipOffPlayers}>
                    {players.map((name, pi) => (
                      <TouchableOpacity key={pi} style={styles.chipOffBtn} onPress={() => awardChipOff('ld', pi)} activeOpacity={0.75}>
                        <Text style={styles.chipOffBtnText}>{name.split(' ')[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {kpCarryover > 0 && (
                <View style={styles.chipOffRow}>
                  <Text style={styles.chipOffLabel}>KP · ×{kpCarryover + 1} beans</Text>
                  <View style={styles.chipOffPlayers}>
                    {players.map((name, pi) => (
                      <TouchableOpacity key={pi} style={styles.chipOffBtn} onPress={() => awardChipOff('kp', pi)} activeOpacity={0.75}>
                        <Text style={styles.chipOffBtnText}>{name.split(' ')[0]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity style={styles.chipOffVoid} onPress={voidCarryovers}>
                <Text style={styles.chipOffVoidText}>No chip-off — void carryover beans</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* Bean totals */}
        <Text style={styles.sectionLabel}>Bean totals</Text>
        {players.map((name, i) => {
          const beans   = beanTotals[i];
          const dollars = beans * beanValue;
          return (
            <View key={i} style={styles.row}>
              <Text style={styles.name}>{name}</Text>
              <Text style={[styles.val, beans < 0 && styles.neg]}>
                {beans >= 0 ? `+${beans}` : beans} beans
              </Text>
              <Text style={[styles.val, dollars < 0 && styles.neg]}>
                {dollars >= 0 ? `+$${dollars.toFixed(2)}` : `-$${Math.abs(dollars).toFixed(2)}`}
              </Text>
            </View>
          );
        })}

        {/* Wager results */}
        {wagers.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Side Wagers {!pro && '🔒'}</Text>
            {wagers.map((w, wi) => (
              <View key={wi} style={styles.row}>
                <Text style={styles.name}>{w.desc}</Text>
                <Text style={styles.val}>
                  {w.winnerId >= 0 ? `${players[w.winnerId]} wins $${w.amt.toFixed(2)}` : 'Pending'}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Payments */}
        <Text style={styles.sectionLabel}>Payments</Text>
        {payments.length === 0 ? (
          <View style={styles.allSquareCard}>
            <Text style={styles.allSquareEmoji}>🎉</Text>
            <Text style={styles.allSquare}>All square!</Text>
            <Text style={styles.allSquareSub}>No payments needed this round.</Text>
          </View>
        ) : payments.map((p, i) => (
          <View key={i} style={styles.paymentCard}>
            <View style={styles.paymentPlayer}>
              <Text style={styles.paymentName}>{players[p.from]}</Text>
              <Text style={styles.paymentRole}>pays</Text>
            </View>
            <View style={styles.paymentArrowWrap}>
              <Text style={styles.paymentAmt}>${p.amt.toFixed(2)}</Text>
              <Text style={styles.paymentArrow}>→</Text>
            </View>
            <View style={[styles.paymentPlayer, { alignItems: 'flex-end' }]}>
              <Text style={styles.paymentName}>{players[p.to]}</Text>
              <Text style={styles.paymentRole}>receives</Text>
            </View>
          </View>
        ))}

        {/* Actions */}
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => (pro ? setShareVisible(true) : setPaywallVisible(true))}>
          <Text style={styles.btnSecText}>📤 Share Results {!pro ? '🔒' : ''}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary, saved && styles.btnSaved]} onPress={saved ? null : saveToStats}>
          <Text style={styles.btnSecText}>{saved ? '✓ Stats Saved' : `💾 Save to Lifetime Stats${!pro ? ' 🔒' : ''}`}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} onPress={newRound}>
          <Text style={styles.btnText}>⛳ New Round</Text>
        </TouchableOpacity>
      </ScrollView>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />

      <ShareCard
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        players={players}
        beanTotals={beanTotals}
        beanValue={beanValue}
        payments={payments}
        wagers={wagers}
        course={course}
      />

      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Start new round?</Text>
            <Text style={styles.confirmSub}>This will clear all scoring data.</Text>
            <TouchableOpacity style={styles.confirmDestructive} onPress={() => { setConfirmVisible(false); dispatch({ type: 'RESET' }); }}>
              <Text style={styles.confirmDestructiveText}>New Round</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmCancel} onPress={() => setConfirmVisible(false)}>
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background },
  content:      { padding: spacing.md, paddingBottom: 100 },
  heading:      { fontSize: 26, fontWeight: '900', color: colors.textDark, marginBottom: spacing.md },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing.md, marginBottom: spacing.xs },

  // Bean totals
  row:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.xs },
  name:   { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textDark },
  val:    { fontSize: 14, fontWeight: '700', color: colors.green, marginLeft: spacing.sm },
  neg:    { color: colors.red },

  // Payment cards
  paymentCard:      { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  paymentPlayer:    { flex: 1 },
  paymentName:      { fontSize: 16, fontWeight: '800', color: colors.textDark },
  paymentRole:      { fontSize: 11, color: colors.textLight, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 },
  paymentArrowWrap: { alignItems: 'center', paddingHorizontal: spacing.sm },
  paymentAmt:       { fontSize: 22, fontWeight: '900', color: colors.green },
  paymentArrow:     { fontSize: 20, color: colors.green, fontWeight: '900', marginTop: 2 },

  // All square
  allSquareCard:  { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', marginBottom: spacing.sm },
  allSquareEmoji: { fontSize: 36, marginBottom: spacing.xs },
  allSquare:      { fontSize: 18, fontWeight: '800', color: colors.green },
  allSquareSub:   { fontSize: 14, color: colors.textLight, marginTop: 4 },

  // Chip-off
  chipOffCard:     { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gold, padding: spacing.md, marginBottom: spacing.sm },
  chipOffTitle:    { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: spacing.sm },
  chipOffRow:      { marginBottom: spacing.sm },
  chipOffLabel:    { fontSize: 13, fontWeight: '600', color: colors.textMid, marginBottom: 6 },
  chipOffPlayers:  { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chipOffBtn:      { flex: 1, minWidth: 64, paddingVertical: 10, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center' },
  chipOffBtnText:  { color: colors.white, fontWeight: '700', fontSize: 14 },
  chipOffVoid:     { marginTop: spacing.xs, alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border },
  chipOffVoidText: { color: colors.textLight, fontSize: 13, fontWeight: '600' },

  // Wagers
  bold:        { fontWeight: '700' },

  // Buttons
  btn:          { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm, shadowColor: colors.green, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.green, shadowOpacity: 0, elevation: 0 },
  btnSaved:     { borderColor: colors.textLight },
  btnText:      { color: colors.white, fontWeight: '800', fontSize: 16 },
  btnSecText:   { color: colors.green, fontWeight: '700', fontSize: 15 },

  // Confirm modal
  confirmOverlay:         { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  confirmCard:            { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, width: '100%', maxWidth: 340 },
  confirmTitle:           { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: spacing.xs },
  confirmSub:             { fontSize: 14, color: colors.textMid, marginBottom: spacing.lg },
  confirmDestructive:     { backgroundColor: colors.red, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  confirmDestructiveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  confirmCancel:          { paddingVertical: 12, alignItems: 'center' },
  confirmCancelText:      { color: colors.textMid, fontSize: 15 },
});
