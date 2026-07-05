import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../utils/theme';
import AccountMenu from './AccountMenu';
import AuthScreen from '../screens/AuthScreen';
import PostRoundScreen from '../screens/PostRoundScreen';
import {
  incrementRoundsPlayed, isTrialUsed, setTrialUsed, setProPlan,
} from '../utils/storage';

// Flip to false when Stripe is live and the paywall should be enforced
const IS_BETA = true;

export default function ProBanner({ pro, onUpgrade, onReset, onSetPro }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);
  const [postRoundVisible, setPostRoundVisible] = useState(false);
  const [postRoundView, setPostRoundView] = useState('nudge'); // 'nudge' | 'paywall'

  async function handleNewRound() {
    setMenuVisible(false);

    if (IS_BETA) {
      // In beta, skip post-round screens and just reset
      onReset?.();
      return;
    }

    const roundsCompleted = await incrementRoundsPlayed();
    const trialAlreadyUsed = await isTrialUsed();

    if (roundsCompleted === 1 && !trialAlreadyUsed) {
      // After round 1 — show trial nudge
      setPostRoundView('nudge');
      setPostRoundVisible(true);
    } else if (roundsCompleted === 2 && trialAlreadyUsed) {
      // After the trial round — show soft paywall
      setPostRoundView('paywall');
      setPostRoundVisible(true);
    } else {
      onReset?.();
    }
  }

  async function handleAcceptTrial() {
    await setTrialUsed();
    await setProPlan('trial');
    onSetPro?.(true);
    setPostRoundVisible(false);
    onReset?.();
  }

  function handlePostRoundSkip() {
    setPostRoundVisible(false);
    onReset?.();
  }

  return (
    <>
      <View style={[styles.banner, pro ? styles.proBanner : styles.freeBanner]}>
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuIcon}>⚙</Text>
        </TouchableOpacity>
        {pro ? (
          <Text style={styles.text}>⛳ TeeWager Pro — all features unlocked</Text>
        ) : (
          <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.text}>TeeWager Free — tap to upgrade to Pro ✨</Text>
          </TouchableOpacity>
        )}
        <View style={[styles.menuBtn, { alignItems: 'flex-end' }]}>
          <AccountMenu size={26} onSignIn={() => setAuthVisible(true)} />
        </View>
      </View>

      <Modal visible={authVisible} animationType="slide" onRequestClose={() => setAuthVisible(false)}>
        <AuthScreen onSkip={() => setAuthVisible(false)} />
      </Modal>

      <PostRoundScreen
        visible={postRoundVisible}
        view={postRoundView}
        onAcceptTrial={handleAcceptTrial}
        onSkip={handlePostRoundSkip}
      />

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Round Options</Text>

            <TouchableOpacity style={styles.menuItem} onPress={handleNewRound}>
              <Text style={styles.menuItemIcon}>🔄</Text>
              <View>
                <Text style={styles.menuItemText}>New Round</Text>
                <Text style={styles.menuItemSub}>Clear all scores and return to setup</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancel} onPress={() => setMenuVisible(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  banner:      { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  freeBanner:  { backgroundColor: colors.gold },
  proBanner:   { backgroundColor: colors.green },
  text:        { flex: 1, color: colors.white, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  menuBtn:     { width: 32, alignItems: 'center' },
  menuIcon:    { fontSize: 18, color: 'rgba(255,255,255,0.85)' },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  menu:        { backgroundColor: colors.white, borderRadius: radius.md, width: '100%', maxWidth: 320, overflow: 'hidden' },
  menuTitle:   { fontSize: 13, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.5, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },

  menuItem:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  menuItemIcon:{ fontSize: 22 },
  menuItemText:{ fontSize: 16, fontWeight: '700', color: colors.textDark },
  menuItemSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },

  menuCancel:  { padding: spacing.md, alignItems: 'center' },
  menuCancelText: { fontSize: 16, color: colors.textMid, fontWeight: '600' },
});
