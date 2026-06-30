import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider, useGame } from './src/context/GameContext';
import { AuthProvider } from './src/context/AuthContext';
import SetupScreen    from './src/screens/SetupScreen';
import RoundNavigator from './src/screens/RoundNavigator';
import { View, ActivityIndicator } from 'react-native';
import { colors } from './src/utils/theme';

function AppContent() {
  const { state, loading } = useGame();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }
  return state.phase === 'round' ? <RoundNavigator /> : <SetupScreen />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <GameProvider>
            <AppContent />
          </GameProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
