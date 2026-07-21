import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  StyleSheet, FlatList,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { isParAllowed, getEffectiveValue, beanLabel } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';

export default function ImpromptuBeanModal({ visible, onClose }) {
  const { state, dispatch, activeBeans, getHolePar } = useGame();
  const { players, scores, currentHole, firstBonus, bonusBeanDescs = {}, holeCount = 18, holeOffset = 0 } = state;

  const [selectedHole, setSelectedHole] = useState(currentHole);
  const [showHolePicker, setShowHolePicker] = useState(false);
  const [bonusDesc, setBonusDesc] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedHole(currentHole);
      setBonusDesc(bonusBeanDescs[currentHole] || '');
    }
  }, [visible, currentHole]);

  useEffect(() => {
    setBonusDesc(bonusBeanDescs[selectedHole] || '');
  }, [selectedHole]);

  const par = getHolePar(selectedHole);

  function getCount(playerIdx, beanId) {
    return scores[playerIdx]?.[selectedHole]?.[beanId] || 0;
  }

  function saveBonusDesc(text) {
    setBonusDesc(text);
    dispatch({ type: 'SET_BONUS_DESC', holeIdx: selectedHole, desc: text });
  }

  function adjustBonus(playerIdx, delta) {
    const bonusBean = activeBeans.find(b => b.id === 'bonusBean');
    if (bonusBean) adjust(playerIdx, bonusBean, delta);
  }

  function adjust(playerIdx, bean, delta) {
    const cur = getCount(playerIdx, bean.id);
    if (cur + delta < 0) return;

    if (bean.solo && delta > 0) {
      // Clear other players first
      players.forEach((_, pi) => {
        if (pi !== playerIdx && getCount(pi, bean.id) > 0) {
          dispatch({ type: 'AWARD_BEAN', playerIdx: pi, holeIdx: selectedHole, beanId: bean.id, delta: -getCount(pi, bean.id), bean });
        }
      });
    }
    dispatch({ type: 'AWARD_BEAN', playerIdx, holeIdx: selectedHole, beanId: bean.id, delta, bean });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Add Bean</Text>
          <TouchableOpacity onPress={() => setShowHolePicker(true)} style={styles.holePill}>
            <Text style={styles.holePillText}>Hole {holeOffset + selectedHole + 1} · Par {par} ▾</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>

          {/* Bonus Bean section */}
          <View style={styles.bonusSection}>
            <Text style={styles.bonusTitle}>⭐ Bonus Bean</Text>
            <TextInput
              style={styles.bonusInput}
              value={bonusDesc}
              onChangeText={saveBonusDesc}
              placeholder="What's the challenge? (e.g. past the oak tree)"
              placeholderTextColor={colors.textLight}
              maxLength={60}
            />
            <View style={styles.bonusPlayerRow}>
              {players.map((name, pi) => {
                const count = getCount(pi, 'bonusBean');
                return (
                  <View key={pi} style={styles.bonusPlayerCell}>
                    <Text style={styles.bonusPlayerName} numberOfLines={1}>{name.split(' ')[0]}</Text>
                    <View style={styles.counter}>
                      <TouchableOpacity
                        style={[styles.adjBtn, count === 0 && styles.adjBtnDisabled]}
                        onPress={() => adjustBonus(pi, -1)}
                        disabled={count === 0}
                      >
                        <Text style={styles.adjBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.count}>{count}</Text>
                      <TouchableOpacity style={styles.adjBtn} onPress={() => adjustBonus(pi, 1)}>
                        <Text style={styles.adjBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {players.map((name, pi) => (
            <View key={pi} style={styles.playerSection}>
              <View style={styles.playerHeader}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={styles.playerName}>{name}</Text>
              </View>

              {activeBeans.filter(b => !b.impromptu).map(bean => {
                const allowed = isParAllowed(bean, par);
                const count   = getCount(pi, bean.id);
                const value   = getEffectiveValue(bean, pi, selectedHole, firstBonus);

                return (
                  <View key={bean.id} style={[styles.beanRow, !allowed && styles.beanRowDimmed]}>
                    <View style={styles.beanInfo}>
                      <Text style={styles.beanName}>{bean.name}</Text>
                      <Text style={[styles.beanDesc, bean.v < 0 && styles.neg]}>
                        {beanLabel(value)}
                        {!allowed ? ' · wrong par' : ''}
                      </Text>
                    </View>
                    <View style={styles.counter}>
                      <TouchableOpacity
                        style={[styles.adjBtn, count === 0 && styles.adjBtnDisabled]}
                        onPress={() => adjust(pi, bean, -1)}
                        disabled={count === 0}
                      >
                        <Text style={styles.adjBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.count}>{count}</Text>
                      <TouchableOpacity
                        style={[styles.adjBtn, !allowed && styles.adjBtnDisabled]}
                        onPress={() => adjust(pi, bean, 1)}
                        disabled={!allowed}
                      >
                        <Text style={styles.adjBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Hole picker sheet */}
        <Modal visible={showHolePicker} transparent animationType="slide">
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Select hole</Text>
                <TouchableOpacity onPress={() => setShowHolePicker(false)}>
                  <Text style={styles.pickerClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={Array.from({ length: holeCount }, (_, i) => i)}
                keyExtractor={i => String(i)}
                numColumns={6}
                contentContainerStyle={styles.holeGrid}
                renderItem={({ item: i }) => (
                  <TouchableOpacity
                    style={[styles.holeCell, selectedHole === i && styles.holeCellActive]}
                    onPress={() => { setSelectedHole(i); setShowHolePicker(false); }}
                  >
                    <Text style={[styles.holeCellText, selectedHole === i && styles.holeCellTextActive]}>
                      {holeOffset + i + 1}
                    </Text>
                    <Text style={[styles.holeCellPar, selectedHole === i && styles.holeCellTextActive]}>
                      P{getHolePar(i)}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  header:  { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, paddingTop: spacing.lg, gap: spacing.sm },
  title:   { fontSize: 18, fontWeight: '800', color: colors.white },
  holePill: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: spacing.sm, alignItems: 'center' },
  holePillText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  doneBtn: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  doneBtnText: { color: colors.white, fontWeight: '700', fontSize: 16 },

  content: { padding: spacing.md, paddingBottom: 60 },

  playerSection: { marginBottom: spacing.lg },
  playerHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  avatar:        { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  avatarText:    { color: colors.white, fontWeight: '700', fontSize: 12 },
  playerName:    { fontSize: 16, fontWeight: '800', color: colors.textDark },

  beanRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  beanRowDimmed: { opacity: 0.4 },
  beanInfo:      { flex: 1 },
  beanName:      { fontSize: 14, fontWeight: '600', color: colors.textDark },
  beanDesc:      { fontSize: 12, color: colors.green, marginTop: 1 },
  neg:           { color: colors.red },

  counter:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  adjBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  adjBtnDisabled:{ backgroundColor: colors.border },
  adjBtnText:    { color: colors.white, fontSize: 18, fontWeight: '700', lineHeight: 22 },
  count:         { fontSize: 18, fontWeight: '800', color: colors.textDark, minWidth: 24, textAlign: 'center' },

  bonusSection:    { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gold, padding: spacing.md, marginBottom: spacing.lg },
  bonusTitle:      { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: spacing.sm },
  bonusInput:      { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: spacing.sm, fontSize: 14, color: colors.textDark, marginBottom: spacing.sm },
  bonusPlayerRow:  { flexDirection: 'row', gap: spacing.sm },
  bonusPlayerCell: { flex: 1, alignItems: 'center', gap: 6 },
  bonusPlayerName: { fontSize: 12, fontWeight: '700', color: colors.textMid },

  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet:   { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: 34 },
  pickerHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pickerTitle:   { fontSize: 17, fontWeight: '700', color: colors.textDark },
  pickerClose:   { fontSize: 16, color: colors.green, fontWeight: '600' },
  holeGrid:      { padding: spacing.md, gap: spacing.sm },
  holeCell:      { flex: 1, margin: 4, aspectRatio: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.offWhite },
  holeCellActive:{ backgroundColor: colors.green, borderColor: colors.green },
  holeCellText:  { fontSize: 15, fontWeight: '800', color: colors.textDark },
  holeCellTextActive: { color: colors.white },
  holeCellPar:   { fontSize: 10, color: colors.textLight },
});
