import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../utils/theme';

// Shared between ScorecardScreen (resolved right after "Finish Round", before
// the round is considered done) and SettleUpScreen (a fallback in case it's
// ever reached with a carryover still unresolved) — one card, one place to
// keep the award/void UI consistent between the two entry points.
export default function ChipOffCard({ ldCarryover, kpCarryover, skinsCarryover, players, onAward, onVoid }) {
  return (
    <>
      <Text style={styles.sectionLabel}>⛳ Chip-Off Required</Text>
      <View style={styles.chipOffCard}>
        <Text style={styles.chipOffTitle}>Unawarded carryover beans — select the chip-off winner</Text>

        {ldCarryover > 0 && (
          <View style={styles.chipOffRow}>
            <Text style={styles.chipOffLabel}>Long Drive · ×{ldCarryover + 1} beans</Text>
            <View style={styles.chipOffPlayers}>
              {players.map((name, pi) => (
                <TouchableOpacity key={pi} style={styles.chipOffBtn} onPress={() => onAward('ld', pi)} activeOpacity={0.75}>
                  <Text style={styles.chipOffBtnText}>{name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {kpCarryover > 0 && (
          <View style={styles.chipOffRow}>
            <Text style={styles.chipOffLabel}>KP · ×{kpCarryover + 1} beans</Text>
            <View style={styles.chipOffPlayers}>
              {players.map((name, pi) => (
                <TouchableOpacity key={pi} style={styles.chipOffBtn} onPress={() => onAward('kp', pi)} activeOpacity={0.75}>
                  <Text style={styles.chipOffBtnText}>{name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {skinsCarryover > 0 && (
          <View style={styles.chipOffRow}>
            <Text style={styles.chipOffLabel}>Skins · ×{skinsCarryover + 1} beans</Text>
            <View style={styles.chipOffPlayers}>
              {players.map((name, pi) => (
                <TouchableOpacity key={pi} style={styles.chipOffBtn} onPress={() => onAward('skins', pi)} activeOpacity={0.75}>
                  <Text style={styles.chipOffBtnText}>{name.split(' ')[0]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.chipOffVoid} onPress={onVoid}>
          <Text style={styles.chipOffVoidText}>No chip-off — void carryover beans</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  sectionLabel:    { fontSize: 11, fontWeight: '800', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  chipOffCard:     { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 2, borderColor: colors.gold, padding: spacing.md, marginBottom: spacing.sm, ...shadow.sm },
  chipOffTitle:    { fontSize: 14, fontWeight: '700', color: colors.textDark, marginBottom: spacing.sm },
  chipOffRow:      { marginBottom: spacing.sm },
  chipOffLabel:    { fontSize: 13, fontWeight: '600', color: colors.textMid, marginBottom: 8 },
  chipOffPlayers:  { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  chipOffBtn:      { flex: 1, minWidth: 64, paddingVertical: 13, borderRadius: radius.sm, backgroundColor: colors.green, alignItems: 'center', ...shadow.green },
  chipOffBtnText:  { color: colors.white, fontWeight: '800', fontSize: 14 },
  chipOffVoid:     { marginTop: spacing.sm, alignItems: 'center', paddingTop: spacing.sm, borderTopWidth: 0.5, borderTopColor: colors.border },
  chipOffVoidText: { color: colors.textLight, fontSize: 13, fontWeight: '600' },
});
