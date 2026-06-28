import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Modal, FlatList,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { BEAN_DEFS } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';
import PaywallModal from '../components/PaywallModal';
import ProBanner from '../components/ProBanner';
import { loadSavedPlayers, savePlayer } from '../utils/storage';

const MAX_FREE_PLAYERS = 4;
const MAX_PRO_PLAYERS  = 5;

export default function SetupScreen() {
  const { dispatch, pro, setPro } = useGame();
  const [playerCount, setPlayerCount] = useState(2);
  const [names, setNames] = useState(['', '', '', '', '']);
  const [beanValue, setBeanValue] = useState('1.00');
  const [enabledBeans, setEnabledBeans] = useState(
    new Set(BEAN_DEFS.filter(b => b.free).map(b => b.id))
  );
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [pickerIdx, setPickerIdx] = useState(null);
  // save prompt state
  const [savePrompt, setSavePrompt] = useState(null); // { name, idx }

  const maxPlayers = pro ? MAX_PRO_PLAYERS : MAX_FREE_PLAYERS;

  useEffect(() => {
    loadSavedPlayers().then(setSavedPlayers);
  }, []);

  function handleNameBlur(idx) {
    const name = names[idx].trim();
    if (!name || savedPlayers.includes(name)) return;
    setSavePrompt({ name, idx });
  }

  async function confirmSave() {
    await savePlayer(savePrompt.name);
    setSavedPlayers(prev => [...prev, savePrompt.name]);
    setSavePrompt(null);
  }

  function selectSavedPlayer(name) {
    setNames(prev => { const n = [...prev]; n[pickerIdx] = name; return n; });
    setPickerIdx(null);
  }

  function toggleBean(id, isFree) {
    if (!isFree && !pro) { setPaywallVisible(true); return; }
    setEnabledBeans(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startRound() {
    const players = names.slice(0, playerCount).map(n => n.trim());
    if (players.some(n => !n)) {
      setSavePrompt({ error: 'Please enter a name for each player.' });
      return;
    }
    const val = parseFloat(beanValue);
    if (isNaN(val) || val <= 0) {
      setSavePrompt({ error: 'Enter a positive dollar amount per bean.' });
      return;
    }
    dispatch({
      type: 'START_ROUND',
      payload: { players, beanValue: val, enabledBeans: [...enabledBeans], wagers: [] },
    });
  }

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>⛳ TeeWager</Text>
        <Text style={styles.sub}>Set up your round</Text>

        {/* Player count */}
        <Text style={styles.label}>Players</Text>
        <View style={styles.row}>
          {[2,3,4,5].map(n => {
            const locked = n > maxPlayers;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.countBtn, playerCount === n && styles.countBtnActive, locked && styles.countBtnLocked]}
                onPress={() => locked ? setPaywallVisible(true) : setPlayerCount(n)}
              >
                <Text style={[styles.countBtnText, playerCount === n && styles.countBtnTextActive]}>
                  {n}{locked ? ' 🔒' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Player name inputs */}
        <Text style={styles.label}>Player names</Text>
        {Array.from({ length: playerCount }, (_, i) => (
          <View key={i} style={styles.playerInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholder={`Player ${i + 1}`}
              placeholderTextColor={colors.textLight}
              value={names[i]}
              onChangeText={v => setNames(prev => { const n = [...prev]; n[i] = v; return n; })}
              onBlur={() => handleNameBlur(i)}
              maxLength={20}
            />
            <TouchableOpacity style={styles.pickerBtn} onPress={() => setPickerIdx(i)}>
              <Text style={styles.pickerBtnText}>▾</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Bean value */}
        <Text style={styles.label}>$ per bean</Text>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          value={beanValue}
          onChangeText={setBeanValue}
          placeholder="1.00"
          placeholderTextColor={colors.textLight}
        />

        {/* Bean list */}
        <Text style={styles.label}>Beans</Text>
        {BEAN_DEFS.map(bean => {
          const locked = !bean.free && !pro;
          const on = enabledBeans.has(bean.id);
          return (
            <View key={bean.id} style={styles.beanRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.beanName}>
                  {locked ? '🔒 ' : ''}{bean.name}
                  <Text style={[styles.beanValue, bean.v < 0 && styles.neg]}>
                    {bean.v > 0 ? ` +${bean.v}` : ` ${bean.v}`}
                  </Text>
                </Text>
                {bean.desc ? <Text style={styles.beanDesc}>{bean.desc}</Text> : null}
              </View>
              <Switch
                value={on && !locked}
                onValueChange={() => toggleBean(bean.id, bean.free)}
                trackColor={{ true: colors.green }}
                disabled={locked}
              />
            </View>
          );
        })}

        <TouchableOpacity style={styles.startBtn} onPress={startRound} activeOpacity={0.85}>
          <Text style={styles.startText}>Start Round →</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Saved player picker */}
      <Modal visible={pickerIdx !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select player</Text>
              <TouchableOpacity onPress={() => setPickerIdx(null)}>
                <Text style={styles.pickerClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={savedPlayers}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerItem} onPress={() => selectSavedPlayer(item)}>
                  <View style={styles.pickerAvatar}>
                    <Text style={styles.pickerAvatarText}>{item.slice(0,2).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.pickerItemText}>{item}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No saved players yet.{'\n'}Type a name and tap away to save it.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* Save player prompt */}
      <Modal visible={!!savePrompt && !savePrompt.error} transparent animationType="fade">
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Save player?</Text>
            <Text style={styles.promptSub}>
              Save <Text style={{ fontWeight: '700' }}>{savePrompt?.name}</Text> to your player list for future rounds?
            </Text>
            <TouchableOpacity style={styles.promptSave} onPress={confirmSave}>
              <Text style={styles.promptSaveText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.promptSkip} onPress={() => setSavePrompt(null)}>
              <Text style={styles.promptSkipText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Error prompt */}
      <Modal visible={!!savePrompt?.error} transparent animationType="fade">
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.promptTitle}>Oops</Text>
            <Text style={styles.promptSub}>{savePrompt?.error}</Text>
            <TouchableOpacity style={styles.promptSave} onPress={() => setSavePrompt(null)}>
              <Text style={styles.promptSaveText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} onUnlock={() => setPro(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 60 },
  heading: { fontSize: 30, fontWeight: '900', color: colors.green, textAlign: 'center', marginTop: spacing.lg },
  sub:     { fontSize: 16, color: colors.textMid, textAlign: 'center', marginBottom: spacing.lg },
  label:   { fontSize: 13, fontWeight: '700', color: colors.textMid, marginTop: spacing.md, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  row:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  countBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white },
  countBtnActive: { backgroundColor: colors.green, borderColor: colors.green },
  countBtnLocked: { opacity: 0.5 },
  countBtnText: { fontWeight: '600', color: colors.textDark },
  countBtnTextActive: { color: colors.white },
  playerInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  input:   { backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, fontSize: 16, color: colors.textDark, marginBottom: spacing.sm },
  pickerBtn: { backgroundColor: colors.green, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center', alignItems: 'center' },
  pickerBtnText: { color: colors.white, fontSize: 18, fontWeight: '700' },
  beanRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.xs },
  beanName: { fontSize: 15, fontWeight: '600', color: colors.textDark },
  beanValue: { color: colors.green },
  neg:      { color: colors.red },
  beanDesc: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  startBtn: { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg },
  startText: { color: colors.white, fontWeight: '800', fontSize: 17 },
  // picker modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet:    { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '60%', paddingBottom: 30 },
  pickerHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pickerTitle:    { fontSize: 17, fontWeight: '700', color: colors.textDark },
  pickerClose:    { fontSize: 16, color: colors.green, fontWeight: '600' },
  pickerItem:     { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pickerAvatar:   { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  pickerAvatarText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  pickerItemText: { fontSize: 16, color: colors.textDark, fontWeight: '500' },
  pickerEmpty:    { padding: spacing.lg, textAlign: 'center', color: colors.textLight, fontSize: 15, lineHeight: 24 },
  // save / error prompt
  promptOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  promptCard:     { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, width: '100%', maxWidth: 340 },
  promptTitle:    { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: spacing.xs },
  promptSub:      { fontSize: 15, color: colors.textMid, marginBottom: spacing.lg, lineHeight: 22 },
  promptSave:     { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  promptSaveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  promptSkip:     { paddingVertical: 10, alignItems: 'center' },
  promptSkipText: { color: colors.textMid, fontSize: 15 },
});
