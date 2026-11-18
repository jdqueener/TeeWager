import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameProvider, useGame } from './src/context/GameContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import SetupScreen    from './src/screens/SetupScreen';
import RoundNavigator from './src/screens/RoundNavigator';
import AuthScreen     from './src/screens/AuthScreen';
import { View, ActivityIndicator } from 'react-native';
import { colors } from './src/utils/theme';
import { captureReferral } from './src/utils/referral';

const RC_IOS_KEY     = 'appl_lpLsIMgYVgtrXxeqYsMYqmigtpS';
const RC_ANDROID_KEY = 'goog_jBnQlLaUiGEBwtJfSWTNCCTQKCt';

function AppContent() {
  const { state, loading } = useGame();
  const { passwordRecovery, clearPasswordRecovery } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  }

  // A password-reset link lands here with no session yet established and no
  // modal already open to host AuthScreen — show the reset form directly,
  // overriding the normal app, until it's done.
  if (passwordRecovery) {
    return <AuthScreen forceStep="reset" onSkip={clearPasswordRecovery} />;
  }

  return state.phase === 'round' ? <RoundNavigator /> : <SetupScreen />;
}

export default function App() {
  useEffect(() => { captureReferral(); }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      try {
        const Purchases = (await import('react-native-purchases')).default;
        const { LOG_LEVEL } = await import('react-native-purchases');
        if (LOG_LEVEL) Purchases.setLogLevel(LOG_LEVEL.ERROR);
        const key = Platform.OS === 'ios' ? RC_IOS_KEY : RC_ANDROID_KEY;
        if (key) Purchases.configure({ apiKey: key });
      } catch (_) {
        // RevenueCat init failed — paywall unavailable but app continues
      }
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer
        documentTitle={{
          formatter: (options, route) => {
            const name = options?.title ?? route?.name;
            return name ? `${name} – TeeWager` : 'TeeWager';
          },
        }}
      >
        <AuthProvider>
          <GameProvider>
            <AppContent />
          </GameProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
