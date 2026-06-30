import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import { colors, spacing, radius } from '../utils/theme';

export default function ProBanner({ pro, onUpgrade, onReset }) {
  const [menuVisible, setMenuVisible] = useState(false);

  return (
    <>
      <View style={[styles.banner, pro ? styles.proBanner : styles.freeBanner]}>
        {pro ? (
          <Text style={styles.text}>⛳ TeeWager Pro — all features unlocked</Text>
        ) : (
          <TouchableOpacity onPress={onUpgrade} activeOpacity={0.85} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.text}>TeeWager Free — tap to upgrade to Pro ✨</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.menuIcon}>⚙</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.menu}>
            <Text style={styles.menuTitle}>Round Options</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                onReset?.();
              }}
            >
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
  menuBtn:     { paddingLeft: spacing.sm },
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
