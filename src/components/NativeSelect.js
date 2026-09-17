import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { colors, spacing, radius, shadow } from '../utils/theme';

// Tap-to-open list picker — the native (iOS/Android) counterpart to a plain
// HTML <select>, which has no React Native equivalent and crashes natively.
export default function NativeSelect({ value, options, onChange }) {
  const [visible, setVisible] = useState(false);
  const current = options.find(o => o.value === value);

  function select(v) {
    onChange(v);
    setVisible(false);
  }

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setVisible(true)} activeOpacity={0.75}>
        <Text style={styles.triggerText} numberOfLines={1}>{current?.label ?? 'Select…'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
            {options.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.option, opt.value === value && styles.optionSelected]}
                onPress={() => select(opt.value)}
                activeOpacity={0.75}
              >
                <Text style={[styles.optionText, opt.value === value && styles.optionTextSelected]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#ccc', borderRadius: radius.sm,
    paddingVertical: 10, paddingHorizontal: 10, backgroundColor: colors.white, marginBottom: 8,
  },
  triggerText: { fontSize: 15, color: colors.textDark, flex: 1 },
  chevron:     { fontSize: 13, color: colors.textLight, marginLeft: 6 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  sheet:   { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.sm, width: '100%', maxWidth: 320, ...shadow.lg },

  option:            { paddingVertical: 14, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  optionSelected:    { backgroundColor: colors.greenPale },
  optionText:        { fontSize: 16, color: colors.textDark },
  optionTextSelected:{ fontWeight: '800', color: colors.green },
});
