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
  const { players, scores, firstBonus, beanValue, wagers, course } = state;
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

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
          <Text style={styles.allSquare}>🎉 All square — no payments needed!</Text>
        ) : payments.map((p, i) => (
          <View key={i} style={styles.paymentCard}>
            <Text style={styles.paymentText}>
              <Text style={styles.bold}>{players[p.from]}</Text>
              {' pays '}
              <Text style={styles.bold}>{players[p.to]}</Text>
            </Text>
            <Text style={styles.paymentAmt}>${p.amt.toFixed(2)}</Text>
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
  content:      { padding: spacing.md, paddingBottom: 80 },
  heading:      { fontSize: 26, fontWeight: '900', color: colors.textDark, marginBottom: spacing.md },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.xs },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.xs },
  name:         { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textDark },
  val:          { fontSize: 14, fontWeight: '600', color: colors.green, marginLeft: spacing.sm },
  neg:          { color: colors.red },
  paymentCard:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.xs },
  paymentText:  { fontSize: 15, color: colors.textDark },
  paymentAmt:   { fontSize: 18, fontWeight: '800', color: colors.green },
  bold:         { fontWeight: '700' },
  allSquare:    { fontSize: 16, color: colors.green, textAlign: 'center', padding: spacing.md },
  btn:          { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginTop: spacing.sm },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.green },
  btnSaved:     { borderColor: colors.textLight },
  btnText:      { color: colors.white, fontWeight: '800', fontSize: 16 },
  btnSecText:   { color: colors.green, fontWeight: '700', fontSize: 15 },
  confirmOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  confirmCard:         { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, width: '100%', maxWidth: 340 },
  confirmTitle:        { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: spacing.xs },
  confirmSub:          { fontSize: 14, color: colors.textMid, marginBottom: spacing.lg },
  confirmDestructive:  { backgroundColor: colors.red, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  confirmDestructiveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  confirmCancel:       { paddingVertical: 12, alignItems: 'center' },
  confirmCancelText:   { color: colors.textMid, fontSize: 15 },
});
