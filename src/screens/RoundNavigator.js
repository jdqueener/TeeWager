import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ScoringScreen      from './ScoringScreen';
import LeaderboardScreen  from './LeaderboardScreen';
import BreakdownScreen    from './BreakdownScreen';
import SettleUpScreen     from './SettleUpScreen';
import StatsScreen        from './StatsScreen';
import ScorecardScreen    from './ScorecardScreen';
import ImpromptuBeanModal from '../components/ImpromptuBeanModal';
import { useGame }        from '../context/GameContext';
import { colors, radius } from '../utils/theme';

const Tab = createBottomTabNavigator();
const ICON = { Scoring: '⛳', Scorecard: '📋', Leaderboard: '🏆', Breakdown: '📊', 'Settle Up': '💰', Stats: '🎖️' };

export default function RoundNavigator() {
  const { pro, setPro } = useGame();
  const [modalVisible, setModalVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);

  function onFabPress() {
    if (!pro) { setPaywallVisible(true); return; }
    setModalVisible(true);
  }

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICON[route.name]}</Text>,
          tabBarActiveTintColor:   colors.green,
          tabBarInactiveTintColor: '#999',
          headerShown: false,
          tabBarStyle: { borderTopWidth: 0.5, borderTopColor: '#ddd' },
        })}
      >
        <Tab.Screen name="Scoring"     component={ScoringScreen} />
        <Tab.Screen name="Scorecard"   component={ScorecardScreen} />
        <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
        <Tab.Screen name="Breakdown"   component={BreakdownScreen} />
        <Tab.Screen name="Settle Up"   component={SettleUpScreen} />
        <Tab.Screen name="Stats"       component={StatsScreen} />
      </Tab.Navigator>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={onFabPress} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
        {!pro && <Text style={styles.fabLock}>🔒</Text>}
      </TouchableOpacity>

      <ImpromptuBeanModal visible={modalVisible} onClose={() => setModalVisible(false)} />

      {/* Inline paywall — lazy import to avoid circular deps */}
      {paywallVisible && (() => {
        const PaywallModal = require('../components/PaywallModal').default;
        return <PaywallModal visible onClose={() => setPaywallVisible(false)} onUnlock={() => { setPro(true); setPaywallVisible(false); }} />;
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 72, // sits just above the tab bar
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.green,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32, marginTop: -2 },
  fabLock: { fontSize: 10, position: 'absolute', top: 6, right: 6 },
});
