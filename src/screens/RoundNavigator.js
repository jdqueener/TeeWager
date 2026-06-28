import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import ScoringScreen    from './ScoringScreen';
import LeaderboardScreen from './LeaderboardScreen';
import BreakdownScreen  from './BreakdownScreen';
import SettleUpScreen   from './SettleUpScreen';
import StatsScreen      from './StatsScreen';
import { colors }       from '../utils/theme';

const Tab = createBottomTabNavigator();

const ICON = { Scoring: '⛳', Leaderboard: '🏆', Breakdown: '📋', 'Settle Up': '💰', Stats: '📊' };

export default function RoundNavigator() {
  return (
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
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} />
      <Tab.Screen name="Breakdown"   component={BreakdownScreen} />
      <Tab.Screen name="Settle Up"   component={SettleUpScreen} />
      <Tab.Screen name="Stats"       component={StatsScreen} />
    </Tab.Navigator>
  );
}
