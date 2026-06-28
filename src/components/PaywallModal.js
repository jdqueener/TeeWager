import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, radius } from '../utils/theme';
import { setPro as storePro } from '../utils/storage';

const PRO_FEATURES = [
  '5 players (vs 4 free)',
  'All 13 built-in beans',
  'Custom bean creator',
  'Impromptu bean button mid-round',
  'Side wagers with settle-up',
  'Screenshot share card',
  'Hole-by-hole breakdown tab',
  'Lifetime stats tracker',
];

export default function PaywallModal({ visible, onClose, onUnlock }) {
  async function handlePurchase() {
    // In production: integrate with RevenueCat or Expo IAP
    await storePro(true);
    onUnlock();
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>⛳</Text>
          <Text style={styles.title}>TeeWager Pro</Text>
          <Text style={styles.price}>$2.99 / month</Text>

          <ScrollView style={styles.featureList} showsVerticalScrollIndicator={false}>
            {PRO_FEATURES.map(f => (
              <View key={f} style={styles.featureRow}>
                <Text style={styles.check}>✓</Text>
                <Text style={styles.featureText}>{f}</Text>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.buyBtn} onPress={handlePurchase} activeOpacity={0.85}>
            <Text style={styles.buyText}>Unlock Pro — $2.99/mo</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.restoreBtn}>
            <Text style={styles.restoreText}>Restore purchase</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card:     { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: 40 },
  emoji:    { fontSize: 40, textAlign: 'center', marginBottom: spacing.sm },
  title:    { fontSize: 24, fontWeight: '800', textAlign: 'center', color: colors.textDark },
  price:    { fontSize: 16, textAlign: 'center', color: colors.gold, fontWeight: '600', marginBottom: spacing.md },
  featureList: { maxHeight: 220, marginBottom: spacing.md },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  check:    { color: colors.green, fontWeight: '800', fontSize: 16, marginRight: spacing.sm },
  featureText: { fontSize: 15, color: colors.textDark, flex: 1 },
  buyBtn:   { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', marginBottom: spacing.md },
  buyText:  { color: colors.white, fontWeight: '800', fontSize: 16 },
  restoreBtn: { alignItems: 'center', marginBottom: spacing.sm },
  restoreText: { color: colors.textMid, fontSize: 14, textDecorationLine: 'underline' },
  closeText: { textAlign: 'center', color: colors.textLight, fontSize: 14, marginTop: spacing.xs },
});
