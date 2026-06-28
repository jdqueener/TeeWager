import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing } from '../utils/theme';

export default function ProBanner({ pro, onUpgrade }) {
  if (pro) {
    return (
      <View style={[styles.banner, styles.proBanner]}>
        <Text style={styles.text}>⛳ TeeWager Pro — all features unlocked</Text>
      </View>
    );
  }
  return (
    <TouchableOpacity style={[styles.banner, styles.freeBanner]} onPress={onUpgrade} activeOpacity={0.85}>
      <Text style={styles.text}>TeeWager Free — tap to upgrade to Pro ✨</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  freeBanner: { backgroundColor: colors.gold },
  proBanner:  { backgroundColor: colors.green },
  text: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
