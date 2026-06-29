import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Platform } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { colors, spacing, radius } from '../utils/theme';

export default function ShareCard({ visible, onClose, players, beanTotals, beanValue, payments, wagers, course }) {
  const shotRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  const pot = beanTotals.reduce((s, t) => s + Math.max(t, 0), 0) * beanValue;
  const date = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const ranked = players
    .map((name, i) => ({ name, beans: beanTotals[i] }))
    .sort((a, b) => b.beans - a.beans);

  async function handleShare() {
    setSharing(true);
    try {
      const uri = await shotRef.current.capture();
      if (Platform.OS === 'web') {
        // Web Share API if available, else trigger download
        const res = await fetch(uri);
        const blob = await res.blob();
        const file = new File([blob], 'teewager.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'TeeWager Results' });
        } else {
          const link = document.createElement('a');
          link.href = uri;
          link.download = 'teewager.png';
          link.click();
        }
      } else {
        const Sharing = require('expo-sharing');
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share TeeWager Results' });
        }
      }
    } catch (e) {
      // sharing cancelled or unavailable — no-op
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }} style={styles.shotWrap}>
          <View style={styles.card}>
            <Text style={styles.header}>⛳ TeeWager</Text>
            <Text style={styles.sub}>
              {course?.name ? `${course.name}${course.tee ? ' · ' + course.tee : ''}` : 'Round Results'}
            </Text>
            <Text style={styles.date}>{date} · ${beanValue.toFixed(2)}/bean</Text>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Leaderboard</Text>
            {ranked.map((p, i) => (
              <View key={i} style={styles.leaderRow}>
                <Text style={styles.leaderRank}>{i + 1}</Text>
                <Text style={styles.leaderName}>{p.name}</Text>
                <Text style={[styles.leaderBeans, p.beans < 0 && styles.neg]}>
                  {p.beans >= 0 ? `+${p.beans}` : p.beans} beans
                </Text>
                <Text style={[styles.leaderDollars, p.beans < 0 && styles.neg]}>
                  ${(p.beans * beanValue).toFixed(2)}
                </Text>
              </View>
            ))}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Settle Up</Text>
            {payments.length === 0 ? (
              <Text style={styles.allSquare}>🎉 All square</Text>
            ) : payments.map((p, i) => (
              <Text key={i} style={styles.paymentLine}>
                <Text style={styles.bold}>{players[p.from]}</Text> pays <Text style={styles.bold}>{players[p.to]}</Text> ${p.amt.toFixed(2)}
              </Text>
            ))}

            {wagers?.length > 0 && (
              <>
                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>Side Wagers</Text>
                {wagers.map((w, i) => (
                  <Text key={i} style={styles.paymentLine}>
                    {w.desc}: {w.winnerId >= 0 ? `${players[w.winnerId]} wins $${w.amt.toFixed(2)}` : 'Pending'}
                  </Text>
                ))}
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Total pot: ${pot.toFixed(2)}</Text>
            </View>
          </View>
        </ViewShot>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
            <Text style={styles.shareBtnText}>{sharing ? 'Preparing…' : '📤 Share'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  shotWrap: { backgroundColor: colors.white },
  card: { width: 320, backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg },
  header: { fontSize: 24, fontWeight: '900', color: colors.green, textAlign: 'center' },
  sub:    { fontSize: 14, fontWeight: '700', color: colors.textDark, textAlign: 'center', marginTop: 2 },
  date:   { fontSize: 12, color: colors.textLight, textAlign: 'center', marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs },
  leaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: spacing.xs },
  leaderRank: { width: 18, fontSize: 13, fontWeight: '800', color: colors.gold },
  leaderName: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textDark },
  leaderBeans: { fontSize: 12, color: colors.green, fontWeight: '600' },
  leaderDollars: { fontSize: 13, color: colors.green, fontWeight: '800', marginLeft: spacing.xs, minWidth: 50, textAlign: 'right' },
  neg: { color: colors.red },
  paymentLine: { fontSize: 13, color: colors.textDark, marginBottom: 4, lineHeight: 18 },
  bold: { fontWeight: '700' },
  allSquare: { fontSize: 14, color: colors.green, fontWeight: '600' },
  footer: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center' },
  footerText: { fontSize: 13, fontWeight: '700', color: colors.textMid },

  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  shareBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: spacing.lg },
  shareBtnText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  closeBtn: { paddingVertical: 12, paddingHorizontal: spacing.lg },
  closeBtnText: { color: colors.white, fontWeight: '600', fontSize: 15 },
});
