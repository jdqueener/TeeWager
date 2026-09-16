import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../utils/theme';

const OPTIONS = Array.from({ length: 15 }, (_, i) => i + 1);

function strokeColor(value, par) {
  if (!value) return null;
  const d = value - par;
  if (d <= -2) return colors.gold;
  if (d === -1) return colors.green;
  if (d === 1)  return '#E67E22';
  if (d >= 2)   return colors.red;
  return null;
}

// Tap-to-open grid picker — the native (iOS/Android) counterpart to the
// web-only <select>-based StrokePicker, since <select> has no RN equivalent.
export default function NativeStrokePicker({ value, par, onChange }) {
  const [visible, setVisible] = useState(false);
  const bg = strokeColor(value, par);

  function select(n) {
    onChange(n);
    setVisible(false);
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, bg && { backgroundColor: bg, borderColor: bg }]}
        onPress={() => setVisible(true)}
        activeOpacity={0.75}
      >
        <Text style={[styles.triggerText, bg && { color: colors.white }]}>{value || '—'}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            <Text style={styles.title}>Strokes</Text>
            <View style={styles.grid}>
              {OPTIONS.map(n => {
                const optBg = strokeColor(n, par);
                const selected = n === value;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.option,
                      optBg && { backgroundColor: optBg, borderColor: optBg },
                      selected && styles.optionSelected,
                    ]}
                    onPress={() => select(n)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.optionText, optBg && { color: colors.white }]}>{n}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity style={styles.clearBtn} onPress={() => select(0)}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 68, paddingVertical: 10, borderRadius: radius.sm,
    borderWidth: 2, borderColor: colors.border, backgroundColor: colors.offWhite,
    alignItems: 'center', justifyContent: 'center',
  },
  triggerText: { fontSize: 22, fontWeight: '800', color: colors.textDark },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet:   { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 340, ...shadow.lg },
  title:   { fontSize: 16, fontWeight: '800', color: colors.textDark, textAlign: 'center', marginBottom: spacing.md },
  grid:    { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },

  option:         { width: 56, height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.offWhite, alignItems: 'center', justifyContent: 'center' },
  optionSelected: { borderColor: colors.green, borderWidth: 2.5 },
  optionText:     { fontSize: 18, fontWeight: '800', color: colors.textDark },

  clearBtn:  { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm },
  clearText: { fontSize: 14, color: colors.textMid, fontWeight: '600', textDecorationLine: 'underline' },
});
