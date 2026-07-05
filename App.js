import 'react-native-gesture-handler';
import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider, useGame } from './src/context/GameContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import SetupScreen    from './src/screens/SetupScreen';
import RoundNavigator from './src/screens/RoundNavigator';
import AuthScreen     from './src/screens/AuthScreen';
import { View, ActivityIndicator } from 'react-native';
import { colors } from './src/utils/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

function AppContent() {
  const { state, loading } = useGame();
  const { user } = useAuth();
  const [seenAuth, setSeenAuth] = useState(null); // null = still checking

  useEffect(() => {
    if (user) { setSeenAuth(true); return; }
    AsyncStorage.getItem('teewager_seen_auth').then(v => setSeenAuth(!!v));
  }, [user]);

  function dismissLanding() {
    AsyncStorage.setItem('teewager_seen_auth', '1');
    setSeenAuth(true);
  }

  if (loading || seenAuth === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  if (!seenAuth) {
    return <AuthScreen onSkip={dismissLanding} />;
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
