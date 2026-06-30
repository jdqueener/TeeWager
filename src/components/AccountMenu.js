import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../utils/theme';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AccountMenu({ onSignIn, size = 36 }) {
  const { user, profile, signOut } = useAuth();
  const [visible, setVisible] = useState(false);

  const displayName = profile?.display_name || user?.email || 'Guest';

  return (
    <>
      <TouchableOpacity
        style={[styles.avatarBtn, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={() => (user ? setVisible(true) : onSignIn?.())}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {user ? (
          <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials(displayName)}</Text>
        ) : (
          <Text style={[styles.avatarIcon, { fontSize: size * 0.45 }]}>👤</Text>
        )}
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.menu}>
            <View style={styles.menuHeader}>
              <View style={styles.menuAvatar}>
                <Text style={styles.menuAvatarText}>{initials(displayName)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuName} numberOfLines={1}>{displayName}</Text>
                {!!user?.email && <Text style={styles.menuEmail} numberOfLines={1}>{user.email}</Text>}
              </View>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={async () => { setVisible(false); await signOut(); }}
            >
              <Text style={styles.menuItemIcon}>🚪</Text>
              <Text style={styles.menuItemText}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuCancel} onPress={() => setVisible(false)}>
              <Text style={styles.menuCancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatarBtn:   { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  avatarText:  { color: colors.white, fontWeight: '800', fontSize: 13 },
  avatarIcon:  { fontSize: 16 },

  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  menu:        { backgroundColor: colors.white, borderRadius: radius.md, width: '100%', maxWidth: 320, overflow: 'hidden' },
  menuHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  menuAvatar:  { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  menuAvatarText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  menuName:    { fontSize: 16, fontWeight: '700', color: colors.textDark },
  menuEmail:   { fontSize: 12, color: colors.textLight, marginTop: 2 },

  menuItem:    { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  menuItemIcon:{ fontSize: 20 },
  menuItemText:{ fontSize: 16, fontWeight: '700', color: colors.textDark },

  menuCancel:  { padding: spacing.md, alignItems: 'center' },
  menuCancelText: { fontSize: 16, color: colors.textMid, fontWeight: '600' },
});
