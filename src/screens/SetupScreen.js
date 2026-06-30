import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Modal, FlatList, ActivityIndicator, Platform,
} from 'react-native';
import { useGame } from '../context/GameContext';
import { BEAN_DEFS, DEFAULT_PARS, beanLabel } from '../utils/beans';
import { colors, spacing, radius } from '../utils/theme';
import PaywallModal from '../components/PaywallModal';
import ProBanner from '../components/ProBanner';
import AccountMenu from '../components/AccountMenu';
import AuthScreen from './AuthScreen';
import { loadSavedPlayers, savePlayer } from '../utils/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import {
  searchCoursesByName,
  searchCoursesByLocation,
  getCourseDetails,
  getAvailableTees,
  getRecentCourses,
  addRecentCourse,
} from '../utils/courseApi';

const MAX_FREE_PLAYERS = 4;
const MAX_PRO_PLAYERS  = 5;
const TEE_COLORS = { Blue: '#1a6fb5', White: '#e0e0e0', Red: '#c0392b', Gold: '#B8860B', Black: '#222', Green: '#1A4A2E' };

export default function SetupScreen() {
  const { dispatch, pro, setPro } = useGame();
  const [playerCount, setPlayerCount] = useState(2);
  const [holeCount, setHoleCount] = useState(18);
  const [nineChoice, setNineChoice] = useState('front'); // 'front' | 'back'
  const [names, setNames] = useState(['', '', '', '', '']);
  const [beanValue, setBeanValue] = useState('1.00');
  const [enabledBeans, setEnabledBeans] = useState(
    new Set(BEAN_DEFS.map(b => b.id))
  );
  const { user } = useAuth();
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [authVisible, setAuthVisible] = useState(false);

  // Show auth prompt on first visit if not signed in
  useEffect(() => {
    if (user) { setAuthVisible(false); return; }
    AsyncStorage.getItem('teewager_seen_auth').then(seen => {
      if (!seen) setAuthVisible(true);
    });
  }, [user]);

  function dismissAuth() {
    AsyncStorage.setItem('teewager_seen_auth', '1');
    setAuthVisible(false);
  }
  const [savedPlayers, setSavedPlayers] = useState([]);
  const [pickerIdx, setPickerIdx] = useState(null);
  const [savePrompt, setSavePrompt] = useState(null);

  // Course state
  const [courseQuery, setCourseQuery] = useState('');
  const [courseResults, setCourseResults] = useState([]);
  const [courseLoading, setCourseLoading] = useState(false);
  const [courseError, setCourseError] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null); // { id, name }
  const [availableTees, setAvailableTees] = useState([]);
  const [selectedTee, setSelectedTee] = useState('');
  const [loadedCourse, setLoadedCourse] = useState(null); // full course detail
  const [recentCourses, setRecentCourses] = useState([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualPars, setManualPars] = useState(DEFAULT_PARS.slice(0, 9).map((p, i) => ({ number: i + 1, par: p, yardage: 0 })));

  // Resize manual par grid when holeCount changes
  useEffect(() => {
    setManualPars(Array.from({ length: holeCount }, (_, i) => ({ number: i + 1, par: DEFAULT_PARS[i] ?? 4, yardage: 0 })));
  }, [holeCount]);

  const maxPlayers = pro ? MAX_PRO_PLAYERS : MAX_FREE_PLAYERS;

  useEffect(() => {
    loadSavedPlayers().then(setSavedPlayers);
    getRecentCourses().then(setRecentCourses);
  }, []);

  // Load tees when a course is selected
  useEffect(() => {
    if (!selectedCourse) return;
    getAvailableTees(selectedCourse.id)
      .then(tees => {
        setAvailableTees(tees);
        setSelectedTee(tees[0] ?? '');
      })
      .catch(() => setAvailableTees([]));
  }, [selectedCourse]);

  // Load full course detail when tee is selected
  useEffect(() => {
    if (!selectedCourse || !selectedTee) return;
    getCourseDetails(selectedCourse.id, selectedTee)
      .then(setLoadedCourse)
      .catch(() => setLoadedCourse(null));
  }, [selectedCourse, selectedTee]);

  async function searchByName() {
    if (!courseQuery.trim()) return;
    setCourseLoading(true);
    setCourseError('');
    try {
      const results = await searchCoursesByName(courseQuery.trim());
      setCourseResults(results);
      if (!results.length) setCourseError('No courses found. Try a different name or enter manually.');
    } catch (e) {
      setCourseError(`Search failed: ${e.message}. Try a different name or enter pars manually.`);
    } finally {
      setCourseLoading(false);
    }
  }

  async function searchByLocation() {
    if (Platform.OS === 'web') {
      // Use browser geolocation on web
      if (!navigator.geolocation) { setCourseError('Location not supported in this browser.'); return; }
      setCourseLoading(true);
      setCourseError('');
      navigator.geolocation.getCurrentPosition(
        async pos => {
          try {
            const results = await searchCoursesByLocation(pos.coords.latitude, pos.coords.longitude);
            setCourseResults(results);
            if (!results.length) setCourseError('No nearby courses found.');
          } catch { setCourseError('Location search failed.'); }
          finally { setCourseLoading(false); }
        },
        () => { setCourseError('Location access denied.'); setCourseLoading(false); }
      );
    } else {
      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setCourseError('Location permission denied.'); return; }
        setCourseLoading(true);
        setCourseError('');
        const pos = await Location.getCurrentPositionAsync({});
        const results = await searchCoursesByLocation(pos.coords.latitude, pos.coords.longitude);
        setCourseResults(results);
        if (!results.length) setCourseError('No nearby courses found.');
      } catch { setCourseError('Location search failed.'); }
      finally { setCourseLoading(false); }
    }
  }

  function selectCourse(course) {
    setSelectedCourse(course);
    setLoadedCourse(null);
    setShowCourseModal(false);
    setCourseResults([]);
  }

  function clearCourse() {
    setSelectedCourse(null);
    setLoadedCourse(null);
    setAvailableTees([]);
    setSelectedTee('');
    setShowManualEntry(false);
  }

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

    const holeOffset = holeCount === 9 && nineChoice === 'back' ? 9 : 0;

    let course = null;
    if (showManualEntry) {
      course = {
        id: 'manual',
        name: 'Manual Entry',
        tee: '',
        totalPar: manualPars.reduce((s, h) => s + h.par, 0),
        holes: manualPars,
      };
    } else if (loadedCourse) {
      course = loadedCourse;
      addRecentCourse({ id: course.id, name: course.name });
    }

    dispatch({
      type: 'START_ROUND',
      payload: { players, beanValue: val, enabledBeans: [...enabledBeans], wagers: [], course, holeCount, holeOffset },
    });
  }

  const courseLabel = loadedCourse
    ? `${loadedCourse.name} · ${loadedCourse.tee} · Par ${loadedCourse.totalPar}`
    : selectedCourse
    ? `${selectedCourse.name} — selecting tee…`
    : null;

  return (
    <View style={styles.root}>
      <ProBanner pro={pro} onUpgrade={() => setPaywallVisible(true)} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <View style={{ width: 36 }} />
          <Text style={styles.heading}>⛳ TeeWager</Text>
          <AccountMenu onSignIn={() => setAuthVisible(true)} />
        </View>
        <Text style={styles.sub}>Set up your round</Text>

        <Modal visible={authVisible} animationType="slide" onRequestClose={dismissAuth}>
          <AuthScreen onSkip={dismissAuth} />
        </Modal>

        {/* Course */}
        <Text style={styles.label}>Course</Text>
        {courseLabel ? (
          <View style={styles.courseChip}>
            <Text style={styles.courseChipText} numberOfLines={1}>{courseLabel}</Text>
            <TouchableOpacity onPress={clearCourse} style={styles.courseChipClear}>
              <Text style={styles.courseChipClearText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.courseSearchRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Search course name…"
                placeholderTextColor={colors.textLight}
                value={courseQuery}
                onChangeText={setCourseQuery}
                onSubmitEditing={searchByName}
                returnKeyType="search"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={searchByName}>
                {courseLoading
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={styles.searchBtnText}>Search</Text>}
              </TouchableOpacity>
            </View>
            <View style={styles.courseAltRow}>
              <TouchableOpacity style={styles.altBtn} onPress={searchByLocation}>
                <Text style={styles.altBtnText}>📍 Use my location</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.altBtn} onPress={() => { setShowManualEntry(true); clearCourse(); }}>
                <Text style={styles.altBtnText}>✏️ Enter manually</Text>
              </TouchableOpacity>
            </View>
            {!!courseError && <Text style={styles.courseError}>{courseError}</Text>}

            {/* Recent courses */}
            {!courseResults.length && recentCourses.length > 0 && (
              <>
                <Text style={styles.recentLabel}>Recent</Text>
                {recentCourses.map(c => (
                  <TouchableOpacity key={c.id} style={styles.courseResult} onPress={() => selectCourse(c)}>
                    <Text style={styles.courseResultName}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Search results */}
            {courseResults.map(c => (
              <TouchableOpacity key={c.id} style={styles.courseResult} onPress={() => selectCourse(c)}>
                <Text style={styles.courseResultName}>{c.name}</Text>
                {(c.city || c.state) && (
                  <Text style={styles.courseResultSub}>{[c.city, c.state].filter(Boolean).join(', ')}</Text>
                )}
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Tee selector */}
        {selectedCourse && !showManualEntry && availableTees.length > 0 && (
          <>
            <Text style={styles.label}>Tees</Text>
            <View style={styles.row}>
              {availableTees.map(tee => (
                <TouchableOpacity
                  key={tee}
                  style={[styles.teeBtn, selectedTee === tee && { backgroundColor: TEE_COLORS[tee] ?? colors.green, borderColor: TEE_COLORS[tee] ?? colors.green }]}
                  onPress={() => setSelectedTee(tee)}
                >
                  <Text style={[styles.teeBtnText, selectedTee === tee && styles.teeBtnTextActive]}>{tee}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Manual par entry */}
        {showManualEntry && (
          <>
            <Text style={styles.label}>Hole pars</Text>
            <View style={styles.manualGrid}>
              {manualPars.map((h, i) => (
                <View key={i} style={styles.manualCell}>
                  <Text style={styles.manualHoleNum}>{i + 1}</Text>
                  <View style={styles.manualParRow}>
                    <TouchableOpacity onPress={() => setManualPars(prev => prev.map((x, j) => j === i ? { ...x, par: Math.max(3, x.par - 1) } : x))}>
                      <Text style={styles.manualAdj}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.manualPar}>{h.par}</Text>
                    <TouchableOpacity onPress={() => setManualPars(prev => prev.map((x, j) => j === i ? { ...x, par: Math.min(6, x.par + 1) } : x))}>
                      <Text style={styles.manualAdj}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.altBtn} onPress={() => setShowManualEntry(false)}>
              <Text style={styles.altBtnText}>Cancel manual entry</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Round length */}
        <Text style={styles.label}>Round length</Text>
        <View style={styles.row}>
          {[9, 18].map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.countBtn, holeCount === n && styles.countBtnActive]}
              onPress={() => setHoleCount(n)}
            >
              <Text style={[styles.countBtnText, holeCount === n && styles.countBtnTextActive]}>
                {n} holes
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {holeCount === 9 && (
          <>
            <Text style={styles.label}>Which 9?</Text>
            <View style={styles.row}>
              {['front', 'back'].map(choice => (
                <TouchableOpacity
                  key={choice}
                  style={[styles.countBtn, nineChoice === choice && styles.countBtnActive]}
                  onPress={() => setNineChoice(choice)}
                >
                  <Text style={[styles.countBtnText, nineChoice === choice && styles.countBtnTextActive]}>
                    {choice === 'front' ? 'Front 9 (1–9)' : 'Back 9 (10–18)'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

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
                  {locked && !pro ? '🔒 ' : ''}{bean.name}
                  <Text style={[styles.beanValue, bean.v < 0 && styles.neg]}>
                    {' — '}{beanLabel(bean.v)}
                  </Text>
                </Text>
                {bean.desc ? <Text style={styles.beanDesc}>{bean.desc}</Text> : null}
              </View>
              <Switch
                value={on}
                onValueChange={() => toggleBean(bean.id, bean.free)}
                trackColor={{ true: colors.green }}
                disabled={locked && !pro}
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
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  heading: { fontSize: 30, fontWeight: '900', color: colors.green, textAlign: 'center' },
  sub:     { fontSize: 16, color: colors.textMid, textAlign: 'center', marginBottom: spacing.lg },
  label:   { fontSize: 13, fontWeight: '700', color: colors.textMid, marginTop: spacing.md, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  row:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },

  // Course search
  courseSearchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  searchBtn:       { backgroundColor: colors.green, borderRadius: radius.sm, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', minWidth: 72 },
  searchBtnText:   { color: colors.white, fontWeight: '700', fontSize: 14 },
  courseAltRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  altBtn:          { flex: 1, paddingVertical: 9, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white },
  altBtnText:      { fontSize: 13, color: colors.textMid, fontWeight: '600' },
  courseError:     { fontSize: 13, color: colors.red, marginTop: spacing.xs, marginBottom: spacing.xs },
  recentLabel:     { fontSize: 12, color: colors.textLight, fontWeight: '600', marginTop: spacing.sm, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  courseResult:    { backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.xs },
  courseResultName:{ fontSize: 15, fontWeight: '600', color: colors.textDark },
  courseResultSub: { fontSize: 12, color: colors.textLight, marginTop: 2 },
  courseChip:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  courseChipText:  { flex: 1, color: colors.white, fontWeight: '700', fontSize: 14 },
  courseChipClear: { paddingLeft: spacing.sm },
  courseChipClearText: { color: 'rgba(255,255,255,0.8)', fontSize: 16, fontWeight: '700' },

  // Tee selector
  teeBtn:         { flex: 1, paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white },
  teeBtnText:     { fontWeight: '600', color: colors.textDark, fontSize: 13 },
  teeBtnTextActive: { color: colors.white },

  // Manual entry
  manualGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  manualCell:  { width: '18%', backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 0.5, borderColor: colors.border, padding: spacing.xs, alignItems: 'center' },
  manualHoleNum: { fontSize: 11, color: colors.textLight, fontWeight: '700', marginBottom: 2 },
  manualParRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  manualPar:   { fontSize: 16, fontWeight: '800', color: colors.textDark, minWidth: 18, textAlign: 'center' },
  manualAdj:   { fontSize: 18, color: colors.green, fontWeight: '700', paddingHorizontal: 2 },

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
  promptOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  promptCard:     { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.lg, width: '100%', maxWidth: 340 },
  promptTitle:    { fontSize: 18, fontWeight: '800', color: colors.textDark, marginBottom: spacing.xs },
  promptSub:      { fontSize: 15, color: colors.textMid, marginBottom: spacing.lg, lineHeight: 22 },
  promptSave:     { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 12, alignItems: 'center', marginBottom: spacing.sm },
  promptSaveText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  promptSkip:     { paddingVertical: 10, alignItems: 'center' },
  promptSkipText: { color: colors.textMid, fontSize: 15 },
});
