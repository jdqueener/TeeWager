import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  StyleSheet, Platform,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { getEffectiveValue } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';

const CELL_W = 38;
const LABEL_W = 70;

export default function ScorecardScreen() {
  const { state, dispatch, activeBeans, getHolePar } = useGame();
  const { players, scores, strokes, firstBonus, beanValue, course, holeCount = 18, holeOffset = 0 } = state;

  const [editCell, setEditCell] = useState(null); // { playerIdx, holeIdx }
  const [editValue, setEditValue] = useState(0);

  const holes = Array.from({ length: holeCount }, (_, i) => i); // 0-based indices into strokes/scores
  const front = holes.slice(0, Math.min(9, holeCount));
  const back  = holeCount > 9 ? holes.slice(9) : [];

  function getStroke(pi, hi) {
    return strokes?.[pi]?.[hi] ?? 0;
  }

  function getHoleBeans(pi, hi) {
    let total = 0;
    activeBeans.forEach(bean => {
      const count = scores[pi]?.[hi]?.[bean.id] || 0;
      if (count > 0) total += count * getEffectiveValue(bean, pi, hi, firstBonus);
    });
    return total;
  }

  function strokeColor(stroke, par) {
    if (!stroke) return null;
    const diff = stroke - par;
    if (diff <= -2) return '#B8860B'; // eagle or better — gold
    if (diff === -1) return colors.green; // birdie
    if (diff === 0)  return null;         // par — default
    if (diff === 1)  return '#E67E22';    // bogey — orange
    return colors.red;                    // double+ — red
  }

  function strokeLabel(stroke, par) {
    if (!stroke) return '-';
    const diff = stroke - par;
    if (diff <= -2) return `${stroke}`; // eagle
    return `${stroke}`;
  }

  function sumStrokes(pi, holeArr) {
    return holeArr.reduce((s, hi) => s + (getStroke(pi, hi) || 0), 0);
  }

  function sumPar(holeArr) {
    return holeArr.reduce((s, hi) => s + getHolePar(hi), 0);
  }

  function openEdit(pi, hi) {
    setEditCell({ playerIdx: pi, holeIdx: hi });
    setEditValue(getStroke(pi, hi) || getHolePar(hi));
  }

  function commitEdit() {
    if (!editCell) return;
    dispatch({ type: 'SET_STROKE', playerIdx: editCell.playerIdx, holeIdx: editCell.holeIdx, value: editValue });
    setEditCell(null);
  }

  const courseName = course?.name ?? 'Scorecard';
  const teeLabel   = course?.tee ? ` · ${course.tee}` : '';

  return (
    <View style={styles.root}>
      <View style={styles.titleBar}>
        <Text style={styles.title} numberOfLines={1}>{courseName}{teeLabel}</Text>
        <Text style={styles.sub}>${beanValue.toFixed(2)}/bean · tap a score to edit</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <HalfCard
          label="OUT"
          holes={front}
          players={players}
          holeOffset={holeOffset}
          getHolePar={getHolePar}
          getStroke={getStroke}
          getHoleBeans={getHoleBeans}
          strokeColor={strokeColor}
          strokeLabel={strokeLabel}
          sumStrokes={sumStrokes}
          sumPar={sumPar}
          course={course}
          onEdit={openEdit}
        />

        {back.length > 0 && (
          <HalfCard
            label="IN"
            holes={back}
            players={players}
            holeOffset={holeOffset}
            getHolePar={getHolePar}
            getStroke={getStroke}
            getHoleBeans={getHoleBeans}
            strokeColor={strokeColor}
            strokeLabel={strokeLabel}
            sumStrokes={sumStrokes}
            sumPar={sumPar}
            course={course}
            onEdit={openEdit}
          />
        )}

        {/* Totals */}
        <View style={styles.totalsCard}>
          <Text style={styles.totalsTitle}>Totals</Text>
          {players.map((name, pi) => {
            const outStrokes = sumStrokes(pi, front);
            const inStrokes  = back.length > 0 ? sumStrokes(pi, back) : 0;
            const tot        = outStrokes + inStrokes;
            const outPar     = sumPar(front);
            const inPar      = back.length > 0 ? sumPar(back) : 0;
            const totPar     = outPar + inPar;
            const diff       = tot > 0 ? tot - totPar : null;
            const totalBeans = holes.reduce((s, hi) => s + getHoleBeans(pi, hi), 0);
            return (
              <View key={pi} style={styles.totalRow}>
                <Text style={styles.totalName}>{name}</Text>
                {back.length > 0 && (
                  <>
                    <Text style={styles.totalSplit}>{outStrokes || '-'}</Text>
                    <Text style={styles.totalSplit}>{inStrokes || '-'}</Text>
                  </>
                )}
                <Text style={styles.totalScore}>{tot || '-'}</Text>
                <Text style={[styles.totalDiff, diff != null && diff < 0 && { color: colors.green }, diff != null && diff > 0 && { color: colors.red }]}>
                  {diff == null ? '' : diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`}
                </Text>
                <Text style={[styles.totalBeans, totalBeans < 0 && { color: colors.red }]}>
                  {totalBeans >= 0 ? `+${totalBeans}` : totalBeans} 🫘
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Stroke entry modal */}
      <Modal visible={!!editCell} transparent animationType="fade" onRequestClose={() => setEditCell(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditCell(null)}>
          <View style={styles.pickerCard} onStartShouldSetResponder={() => true}>
            {editCell && (
              <>
                <Text style={styles.pickerTitle}>
                  Hole {holeOffset + editCell.holeIdx + 1} · Par {getHolePar(editCell.holeIdx)}
                </Text>
                <Text style={styles.pickerPlayer}>{players[editCell.playerIdx]}</Text>
                <View style={styles.pickerRow}>
                  <TouchableOpacity style={styles.adjBtn} onPress={() => setEditValue(v => Math.max(1, v - 1))}>
                    <Text style={styles.adjText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickerVal}>{editValue}</Text>
                  <TouchableOpacity style={styles.adjBtn} onPress={() => setEditValue(v => v + 1)}>
                    <Text style={styles.adjText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.doneBtn} onPress={commitEdit}>
                  <Text style={styles.doneBtnText}>Save</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function HalfCard({ label, holes, players, holeOffset, getHolePar, getStroke, getHoleBeans, strokeColor, strokeLabel, sumStrokes, sumPar, course, onEdit }) {
  return (
    <View style={styles.card}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          {/* Hole number row */}
          <View style={styles.row}>
            <Text style={[styles.labelCell, styles.headerCell]}>HOLE</Text>
            {holes.map(hi => (
              <Text key={hi} style={[styles.cell, styles.headerCell]}>{holeOffset + hi + 1}</Text>
            ))}
            <Text style={[styles.totalCell, styles.headerCell]}>{label}</Text>
          </View>

          {/* Yardage row */}
          {course?.holes && (
            <View style={styles.row}>
              <Text style={[styles.labelCell, styles.infoCell]}>YDS</Text>
              {holes.map(hi => (
                <Text key={hi} style={[styles.cell, styles.infoCell]}>
                  {course.holes[holeOffset + hi]?.yardage || '-'}
                </Text>
              ))}
              <Text style={[styles.totalCell, styles.infoCell]}>
                {holes.reduce((s, hi) => s + (course.holes[holeOffset + hi]?.yardage || 0), 0)}
              </Text>
            </View>
          )}

          {/* Handicap row */}
          {course?.holes && (
            <View style={styles.row}>
              <Text style={[styles.labelCell, styles.infoCell]}>HCP</Text>
              {holes.map(hi => (
                <Text key={hi} style={[styles.cell, styles.infoCell]}>
                  {course.holes[holeOffset + hi]?.handicap || '-'}
                </Text>
              ))}
              <Text style={[styles.totalCell, styles.infoCell]}></Text>
            </View>
          )}

          {/* Par row */}
          <View style={[styles.row, styles.parRow]}>
            <Text style={[styles.labelCell, styles.parCell]}>PAR</Text>
            {holes.map(hi => (
              <Text key={hi} style={[styles.cell, styles.parCell]}>{getHolePar(hi)}</Text>
            ))}
            <Text style={[styles.totalCell, styles.parCell]}>{sumPar(holes)}</Text>
          </View>

          {/* Player rows */}
          {players.map((name, pi) => {
            const total = sumStrokes(pi, holes);
            const par   = sumPar(holes);
            return (
              <View key={pi}>
                <View style={[styles.row, pi % 2 === 1 && styles.rowAlt]}>
                  <Text style={styles.labelCell} numberOfLines={1}>{name}</Text>
                  {holes.map(hi => {
                    const s   = getStroke(pi, hi);
                    const p   = getHolePar(hi);
                    const bg  = strokeColor(s, p);
                    const beans = getHoleBeans(pi, hi);
                    return (
                      <TouchableOpacity
                        key={hi}
                        style={[styles.scoreCell, bg && { backgroundColor: bg }]}
                        onPress={() => onEdit(pi, hi)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.scoreText, bg && { color: colors.white }]}>
                          {s || '-'}
                        </Text>
                        {beans !== 0 && (
                          <Text style={styles.beanDot}>
                            {beans > 0 ? `+${beans}` : beans}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                  <View style={[styles.scoreTotalCell, pi % 2 === 1 && styles.rowAlt]}>
                    <Text style={styles.scoreTotalText}>{total || '-'}</Text>
                    {total > 0 && (
                      <Text style={[styles.diffText,
                        total - par < 0 && { color: colors.green },
                        total - par > 0 && { color: colors.red }
                      ]}>
                        {total - par === 0 ? 'E' : total - par > 0 ? `+${total - par}` : total - par}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1, backgroundColor: colors.background },
  titleBar:    { backgroundColor: colors.green, padding: spacing.md, paddingTop: spacing.lg },
  title:       { fontSize: 17, fontWeight: '800', color: colors.white },
  sub:         { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  content:     { padding: spacing.sm, paddingBottom: 80 },

  card:        { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, marginBottom: spacing.sm, overflow: 'hidden' },

  row:         { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowAlt:      { backgroundColor: colors.offWhite },
  parRow:      { backgroundColor: '#e8f5ee' },

  labelCell:   { width: LABEL_W, fontSize: 11, fontWeight: '700', color: colors.textDark, paddingHorizontal: spacing.xs, paddingVertical: 6 },
  cell:        { width: CELL_W, textAlign: 'center', fontSize: 11, paddingVertical: 6 },
  totalCell:   { width: CELL_W + 6, textAlign: 'center', fontSize: 11, fontWeight: '800', paddingVertical: 6 },

  headerCell:  { color: colors.white, backgroundColor: colors.green, fontWeight: '800', fontSize: 11 },
  infoCell:    { color: colors.textMid, fontSize: 10 },
  parCell:     { color: colors.green, fontWeight: '800', fontSize: 12 },

  scoreCell:   { width: CELL_W, alignItems: 'center', paddingVertical: 4, borderRightWidth: 0.5, borderRightColor: colors.border },
  scoreText:   { fontSize: 13, fontWeight: '700', color: colors.textDark },
  beanDot:     { fontSize: 8, color: colors.gold, fontWeight: '700' },
  scoreTotalCell: { width: CELL_W + 6, alignItems: 'center', paddingVertical: 4, borderLeftWidth: 1, borderLeftColor: colors.border },
  scoreTotalText: { fontSize: 14, fontWeight: '800', color: colors.textDark },
  diffText:    { fontSize: 9, fontWeight: '700', color: colors.textMid },

  totalsCard:  { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md },
  totalsTitle: { fontSize: 13, fontWeight: '800', color: colors.textMid, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  totalRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  totalName:   { flex: 1, fontSize: 14, fontWeight: '700', color: colors.textDark },
  totalSplit:  { fontSize: 13, color: colors.textMid, width: 32, textAlign: 'center' },
  totalScore:  { fontSize: 18, fontWeight: '900', color: colors.textDark, width: 40, textAlign: 'center' },
  totalDiff:   { fontSize: 13, fontWeight: '700', color: colors.textMid, width: 36, textAlign: 'center' },
  totalBeans:  { fontSize: 13, fontWeight: '700', color: colors.green, width: 60, textAlign: 'right' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  pickerCard:   { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, width: '100%', maxWidth: 280, alignItems: 'center' },
  pickerTitle:  { fontSize: 16, fontWeight: '700', color: colors.textMid, marginBottom: 4 },
  pickerPlayer: { fontSize: 20, fontWeight: '900', color: colors.textDark, marginBottom: spacing.md },
  pickerRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  adjBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  adjText:      { color: colors.white, fontSize: 24, fontWeight: '300', lineHeight: 28 },
  pickerVal:    { fontSize: 48, fontWeight: '900', color: colors.textDark, minWidth: 64, textAlign: 'center' },
  doneBtn:      { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: spacing.xl },
  doneBtnText:  { color: colors.white, fontWeight: '800', fontSize: 16 },
});
