import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider, useGame } from './src/context/GameContext';
import { AuthProvider } from './src/context/AuthContext';
import SetupScreen    from './src/screens/SetupScreen';
import RoundNavigator from './src/screens/RoundNavigator';
import { View, ActivityIndicator } from 'react-native';
import { colors } from './src/utils/theme';
import { captureReferral } from './src/utils/referral';

// Capture ?ref= partner code as early as possible
captureReferral();

const RC_IOS_KEY     = 'appl_lpLsIMgYVgtrXxeqYsMYqmigtpS';
const RC_ANDROID_KEY = ''; // fill in after Google Play Console is set up

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
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      const Purchases = (await import('react-native-purchases')).default;
      const { LOG_LEVEL } = await import('react-native-purchases');
      Purchases.setLogLevel(LOG_LEVEL.ERROR);
      const key = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
      if (key) Purchases.configure({ apiKey: key });
    })();
  }, []);

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
