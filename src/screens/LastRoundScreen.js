import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../utils/theme';
import BreakdownScreen from './BreakdownScreen';
import SettleUpScreen from './SettleUpScreen';

// Read-only viewer for the last finished round (see GameContext's lastRound/
// saveLastRound) — a lightweight tab switcher between Breakdown and Settle
// Up, each fed the saved snapshot instead of live round state. Scorecard and
// Stats aren't included here; the tester feedback this was built from asked
// specifically for the breakdown and settle-up detail, not a full replay.
export default function LastRoundScreen({ lastRound, onClose }) {
  const [tab, setTab] = useState('breakdown'); // 'breakdown' | 'settleUp'
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.tabBar, { paddingTop: insets.top }]}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'breakdown' && styles.tabBtnActive]}
          onPress={() => setTab('breakdown')}
        >
          <Text style={[styles.tabText, tab === 'breakdown' && styles.tabTextActive]}>📊 Breakdown</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'settleUp' && styles.tabBtnActive]}
          onPress={() => setTab('settleUp')}
        >
          <Text style={[styles.tabText, tab === 'settleUp' && styles.tabTextActive]}>💰 Settle Up</Text>
        </TouchableOpacity>
      </View>

      {tab === 'breakdown'
        ? <BreakdownScreen historicalState={lastRound} onClose={onClose} />
        : <SettleUpScreen historicalState={lastRound} onClose={onClose} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: colors.background },
  tabBar:       { flexDirection: 'row', backgroundColor: colors.white, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  tabBtn:       { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.green },
  tabText:      { fontSize: 14, fontWeight: '700', color: colors.textLight },
  tabTextActive:{ color: colors.green },
});
