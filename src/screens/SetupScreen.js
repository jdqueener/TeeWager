import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Modal, FlatList, ActivityIndicator, Platform, Linking, Image, Alert,
} from 'react-native';
const ImagePicker = Platform.OS !== 'web' ? require('expo-image-picker') : null;
import { useGame } from '../context/GameContext';
import { BEAN_DEFS, DEFAULT_PARS, beanLabel } from '../utils/beans';
import { colors, spacing, radius, shadow } from '../utils/theme';
import PaywallModal from '../components/PaywallModal';
import ProBanner from '../components/ProBanner';
import AccountMenu from '../components/AccountMenu';
import AuthScreen from './AuthScreen';
import OnboardingScreen from './OnboardingScreen';
import { loadSavedPlayers, savePlayer, deleteSavedPlayer, hasOnboarded, setOnboarded } from '../utils/storage';
import { useAuth } from '../context/AuthContext';
import {
  searchCoursesByName,
  searchCoursesByLocation,
  getCourseDetails,
  getAvailableTees,
  getRecentCourses,
  addRecentCourse,
  removeRecentCourse,
} from '../utils/courseApi';
import { searchCustomCourses, saveCustomCourse, parseScorecardImage } from '../utils/customCourseApi';

const MAX_FREE_PLAYERS = 4;
const MAX_PRO_PLAYERS  = 5;
const TEE_COLORS = { Blue: '#1a6fb5', White: '#e0e0e0', Red: '#c0392b', Gold: '#B8860B', Black: '#222', Green: '#1A4A2E' };

export default function SetupScreen() {
  const { dispatch, pro, setPro, canPlay, roundsLeft } = useGame();
  const [trialExpiredVisible, setTrialExpiredVisible] = useState(false);
  const [playerCount, setPlayerCount] = useState(2);
  const [holeCount, setHoleCount] = useState(18);
  const [nineChoice, setNineChoice] = useState('front'); // 'front' | 'back'
  const [names, setNames] = useState(['', '', '', '', '']);
  const [beanValue, setBeanValue] = useState('1.00');
  const [enabledBeans, setEnabledBeans] = useState(
    new Set(BEAN_DEFS.map(b => b.id))
  );
  const [customBeans, setCustomBeans] = useState([]);
  const [pressEnabled, setPressEnabled] = useState(false);
  const [pressMode, setPressMode] = useState('anytime');
  const [spotsEnabled, setSpotsEnabled] = useState(false);
  const [spots, setSpots] = useState([0, 0, 0, 0, 0]);
  const [ldCarryoverEnabled, setLdCarryoverEnabled] = useState(true);
  const [kpCarryoverEnabled, setKpCarryoverEnabled] = useState(true);
  const { user } = useAuth();
  const [paywallVisible, setPaywallVisible] = useState(false);

  // Read ?mode= from URL on web to auto-open auth in correct tab
  const urlMode = (() => {
    if (Platform.OS !== 'web') return null;
    try { return (new URLSearchParams(window.location.search)).get('mode') ?? null; } catch { return null; }
  })();
  const isGuest = () => { try { return sessionStorage.getItem('tw_guest') === '1'; } catch { return false; } };
  const setGuest = () => { try { sessionStorage.setItem('tw_guest', '1'); } catch {} };
  const [guestMode, setGuestMode] = useState(isGuest);
  const guestModeRef = useRef(isGuest());
  const mountedRef = useRef(false);
  const [authVisible, setAuthVisible] = useState(() => !user && !isGuest() || urlMode === 'signin' || urlMode === 'signup');
  const [authInitialMode, setAuthInitialMode] = useState(urlMode === 'signup' ? 'signup' : 'signin');
  const [onboardingVisible, setOnboardingVisible] = useState(false);

  // On native first launch, show onboarding before auth
  useEffect(() => {
    if (Platform.OS === 'web') return;
    hasOnboarded().then(done => {
      if (!done && !user) setOnboardingVisible(true);
    });
  }, []);

  function handleOnboardingDone(intent) {
    setOnboarded();
    setOnboardingVisible(false);
    if (intent === 'guest') {
      setGuestMode(true);
    } else if (intent === 'signup') {
      setAuthInitialMode('signup');
      setAuthVisible(true);
    } else if (intent === 'signin') {
      setAuthInitialMode('signin');
      setAuthVisible(true);
    }
  }

  // Show auth screen when user signs out, unless they chose guest
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    if (!user && !guestModeRef.current) { setAuthInitialMode('signin'); setAuthVisible(true); }
  }, [user]);
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
  const [manualCourseName, setManualCourseName] = useState('');
  const [manualPars, setManualPars] = useState(DEFAULT_PARS.slice(0, 9).map((p, i) => ({ number: i + 1, par: p, yardage: 0 })));
  const [photoLoading, setPhotoLoading] = useState(false);

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
      const [apiResults, customResults] = await Promise.allSettled([
        searchCoursesByName(courseQuery.trim()),
        searchCustomCourses(courseQuery.trim()),
      ]);
      const combined = [
        ...(apiResults.status === 'fulfilled' ? apiResults.value : []),
        ...(customResults.status === 'fulfilled' ? customResults.value : []),
      ];
      setCourseResults(combined);
      if (!combined.length) setCourseError('no_results');
    } catch (e) {
      setCourseError(`Search failed: ${e.message}. Try a different name.`);
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
    if (course.custom && course.holes?.length) {
      // Custom course already has full hole data — load it directly
      const totalPar = course.holes.reduce((s, h) => s + (h.par ?? 4), 0);
      setLoadedCourse({ id: course.id, name: course.name, tee: '', totalPar, holes: course.holes, custom: true });
      setSelectedCourse(course);
    } else {
      setSelectedCourse(course);
      setLoadedCourse(null);
    }
    setShowCourseModal(false);
    setCourseResults([]);
    setCourseError('');
  }

  function clearCourse() {
    setSelectedCourse(null);
    setLoadedCourse(null);
    setAvailableTees([]);
    setSelectedTee('');
    setShowManualEntry(false);
    setManualCourseName('');
  }

  async function takeScorecardPhoto() {
    if (!ImagePicker) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to scan a scorecard.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ base64: true, quality: 0.8 });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    setPhotoLoading(true);
    try {
      const holes = await parseScorecardImage(result.assets[0].base64);
      setManualPars(holes.map(h => ({ number: h.number, par: h.par ?? 4, yardage: h.yardage ?? 0 })));
      setShowManualEntry(true);
    } catch {
      Alert.alert('Could not read scorecard', 'Try again with a clearer photo, or enter hole pars manually.');
    } finally {
      setPhotoLoading(false);
    }
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

  function addCustomBean() {
    const id = `custom_${Date.now()}`;
    setCustomBeans(prev => [...prev, { id, name: '', v: 1, fb: false, free: true, custom: true }]);
    setEnabledBeans(prev => new Set([...prev, id]));
  }

  function updateCustomBeanName(id, name) {
    setCustomBeans(prev => prev.map(b => b.id === id ? { ...b, name } : b));
  }

  function removeCustomBean(id) {
    setCustomBeans(prev => prev.filter(b => b.id !== id));
    setEnabledBeans(prev => { const next = new Set(prev); next.delete(id); return next; });
  }

  function toggleBean(id, isFree) {
    if (!isFree && !pro) { setPaywallVisible(true); return; }
    setEnabledBeans(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function startRound() {
    if (!canPlay) { setTrialExpiredVisible(true); return; }
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
      const name = manualCourseName.trim() || 'Custom Course';
      let savedId = 'manual_' + Date.now();
      try {
        const saved = await saveCustomCourse(name, manualPars);
        savedId = saved.id;
      } catch {}
      course = {
        id: savedId,
        name,
        tee: '',
        totalPar: manualPars.reduce((s, h) => s + h.par, 0),
        holes: manualPars,
        custom: true,
      };
      addRecentCourse({ id: savedId, name });
    } else if (loadedCourse) {
      course = loadedCourse;
      addRecentCourse({ id: course.id, name: course.name });
    }

    const validCustom = customBeans.filter(b => b.name.trim());
    const allEnabled = [...enabledBeans].filter(id =>
      !id.startsWith('custom_') || validCustom.some(b => b.id === id)
    );
    dispatch({
      type: 'START_ROUND',
      payload: { players, beanValue: val, enabledBeans: allEnabled, customBeans: validCustom, wagers: [], course, holeCount, holeOffset, pressMode: pressEnabled ? pressMode : null, spots: spotsEnabled ? spots.slice(0, players.length) : players.map(() => 0), ldCarryoverEnabled, kpCarryoverEnabled },
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
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroEmojiRing}>
            <Text style={styles.heroEmoji}>⛳</Text>
          </View>
          <Text style={styles.heroTitle}>TeeWager</Text>
          <View style={styles.heroDivider} />
          <Text style={styles.heroSub}>Set up your round</Text>
        </View>

        <Modal visible={onboardingVisible} animationType="fade">
          <OnboardingScreen onDone={handleOnboardingDone} />
        </Modal>

        <Modal visible={authVisible} animationType="slide" onRequestClose={() => { setGuestMode(true); setAuthVisible(false); }}>
          <AuthScreen onSkip={(asGuest) => { if (asGuest) { setGuest(); guestModeRef.current = true; setGuestMode(true); } setAuthVisible(false); }} initialMode={authInitialMode} />
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
                placeholder="Search by course name (e.g. Pine Ridge)…"
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
            {!!courseError && courseError !== 'no_results' && (
              <Text style={styles.courseError}>{courseError}</Text>
            )}
            {courseError === 'no_results' && (
              <View style={styles.noResultsCard}>
                <Text style={styles.noResultsTitle}>Course not found?</Text>
                <Text style={styles.noResultsSub}>Add it so you and others can use it next time.</Text>
                <View style={styles.noResultsRow}>
                  <TouchableOpacity style={styles.noResultsBtn} onPress={() => { setShowManualEntry(true); setCourseError(''); }}>
                    <Text style={styles.noResultsBtnText}>Enter manually</Text>
                  </TouchableOpacity>
                  {Platform.OS !== 'web' && (
                    <TouchableOpacity style={[styles.noResultsBtn, { backgroundColor: colors.green }]} onPress={() => { setCourseError(''); takeScorecardPhoto(); }}>
                      {photoLoading
                        ? <ActivityIndicator color={colors.white} size="small" />
                        : <Text style={[styles.noResultsBtnText, { color: colors.white }]}>📷 Scan scorecard</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Recent courses */}
            {!courseResults.length && recentCourses.length > 0 && (
              <>
                <Text style={styles.recentLabel}>Recent</Text>
                {recentCourses.map(c => (
                  <View key={c.id} style={styles.recentRow}>
                    <TouchableOpacity style={styles.recentName} onPress={() => selectCourse(c)}>
                      <Text style={styles.courseResultName}>{c.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.recentRemove}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={async () => {
                        await removeRecentCourse(c.id);
                        setRecentCourses(prev => prev.filter(r => r.id !== c.id));
                      }}
                    >
                      <Text style={styles.recentRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Search results */}
            {courseResults.map(c => (
              <TouchableOpacity key={c.id} style={styles.courseResult} onPress={() => selectCourse(c)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.courseResultName}>{c.name}</Text>
                  {c.custom && <Text style={styles.customBadge}>custom</Text>}
                </View>
                {(c.city || c.state) && (
                  <Text style={styles.courseResultSub}>{[c.city, c.state].filter(Boolean).join(', ')}</Text>
                )}
              </TouchableOpacity>
            ))}

            {/* Always-visible add course option */}
            <View style={styles.addCourseRow}>
              <TouchableOpacity onPress={() => { setShowManualEntry(true); setCourseError(''); }} style={styles.addCourseLink}>
                <Text style={styles.addCourseLinkText}>Don't see your course? Add it manually</Text>
              </TouchableOpacity>
              {Platform.OS !== 'web' && (
                <TouchableOpacity onPress={() => { setCourseError(''); takeScorecardPhoto(); }} style={styles.addCourseLink}>
                  {photoLoading
                    ? <ActivityIndicator color={colors.green} size="small" />
                    : <Text style={styles.addCourseLinkText}>📷 Scan scorecard</Text>}
                </TouchableOpacity>
              )}
            </View>
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

        {/* Manual course entry */}
        {showManualEntry && (
          <>
            <Text style={styles.label}>Course name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Riverside Municipal"
              placeholderTextColor={colors.textLight}
              value={manualCourseName}
              onChangeText={setManualCourseName}
              maxLength={60}
            />
            {Platform.OS !== 'web' && (
              <View style={styles.manualScanRow}>
                <TouchableOpacity style={styles.scanBtn} onPress={takeScorecardPhoto} disabled={photoLoading}>
                  {photoLoading
                    ? <ActivityIndicator color={colors.green} size="small" />
                    : <Text style={styles.scanBtnText}>📷 Scan scorecard instead</Text>}
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.label}>Hole pars &amp; yardage</Text>
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
                  <TextInput
                    style={styles.manualYardage}
                    keyboardType="number-pad"
                    placeholder="yds"
                    placeholderTextColor={colors.textLight}
                    value={h.yardage > 0 ? String(h.yardage) : ''}
                    onChangeText={v => setManualPars(prev => prev.map((x, j) => j === i ? { ...x, yardage: parseInt(v) || 0 } : x))}
                    maxLength={4}
                  />
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.altBtn} onPress={() => { setShowManualEntry(false); setManualCourseName(''); }}>
              <Text style={styles.altBtnText}>Cancel</Text>
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

        {/* Handicap beans */}
        <Text style={styles.label}>Handicap</Text>
        <View style={[styles.beanRow, { borderLeftColor: colors.green }]}>
          <View style={[styles.beanDot, { backgroundColor: colors.green }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.beanName}>Enable Handicap Beans</Text>
            <Text style={styles.beanDesc}>Give players a bean head-start to balance handicaps</Text>
          </View>
          <Switch value={spotsEnabled} onValueChange={setSpotsEnabled} trackColor={{ true: colors.green }} />
        </View>
        {spotsEnabled && (
          <View style={styles.spotsWrap}>
            {names.slice(0, playerCount).map((name, i) => (
              <View key={i} style={styles.spotRow}>
                <Text style={styles.spotName} numberOfLines={1}>{name || `Player ${i + 1}`}</Text>
                <View style={styles.spotControls}>
                  <TouchableOpacity style={styles.spotBtn} onPress={() => setSpots(prev => { const n = [...prev]; n[i] = Math.max(0, n[i] - 1); return n; })} activeOpacity={0.75}>
                    <Text style={styles.spotBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.spotVal}>{spots[i] ?? 0}</Text>
                  <TouchableOpacity style={styles.spotBtn} onPress={() => setSpots(prev => { const n = [...prev]; n[i] = (n[i] ?? 0) + 1; return n; })} activeOpacity={0.75}>
                    <Text style={styles.spotBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <Text style={styles.spotHint}>Spotted beans are added to each player's total at settlement</Text>
          </View>
        )}

        {/* Press */}
        <Text style={styles.label}>Press</Text>
        <View style={[styles.beanRow, { borderLeftColor: colors.gold }]}>
          <View style={[styles.beanDot, { backgroundColor: colors.gold }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.beanName}>Enable press</Text>
            <Text style={styles.beanDesc}>Allow players to increase the wager mid-round</Text>
          </View>
          <Switch value={pressEnabled} onValueChange={setPressEnabled} trackColor={{ true: colors.gold }} />
        </View>
        {pressEnabled && (
          <View style={styles.pressOptions}>
            {[
              { key: 'anytime', label: 'Press anytime', desc: 'Doubles beans from that hole, stays for the rest of the round' },
              { key: 'tenth', label: 'Before hole 10 only', desc: 'One press available — doubles beans for the back 9' },
              { key: 'perHole', label: 'Per-hole side bet', desc: 'Pick players each hole — just for that hole (2-player presses allowed)' },
            ].map(opt => (
              <TouchableOpacity key={opt.key} style={styles.pressOption} onPress={() => setPressMode(opt.key)} activeOpacity={0.75}>
                <View style={[styles.pressRadio, pressMode === opt.key && styles.pressRadioActive]}>
                  {pressMode === opt.key && <View style={styles.pressRadioDot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pressOptionLabel, pressMode === opt.key && { color: colors.gold }]}>{opt.label}</Text>
                  <Text style={styles.pressOptionDesc}>{opt.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bean list */}
        <Text style={styles.label}>Beans</Text>
        {BEAN_DEFS.filter(b => !b.impromptu).map(bean => {
          const locked = !bean.free && !pro;
          const on = enabledBeans.has(bean.id);
          return (
            <React.Fragment key={bean.id}>
              <View style={[styles.beanRow, { borderLeftColor: locked ? colors.gold : colors.green }]}>
                <View style={[styles.beanDot, { backgroundColor: locked ? colors.gold : colors.green }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.beanName}>
                    {bean.name}
                    {locked && <Text style={styles.beanProBadge}> PRO</Text>}
                    <Text style={[styles.beanValue, bean.v < 0 && styles.neg]}>
                      {'  '}{beanLabel(bean.v)}
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
              {bean.id === 'longDrive' && on && (
                <View style={styles.carryoverRow}>
                  <Text style={styles.carryoverLabel}>Carry over Long Drive</Text>
                  <Switch
                    value={ldCarryoverEnabled}
                    onValueChange={setLdCarryoverEnabled}
                    trackColor={{ true: colors.green }}
                  />
                </View>
              )}
              {bean.id === 'kp' && on && (
                <View style={styles.carryoverRow}>
                  <Text style={styles.carryoverLabel}>Carry over KP</Text>
                  <Switch
                    value={kpCarryoverEnabled}
                    onValueChange={setKpCarryoverEnabled}
                    trackColor={{ true: colors.green }}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}

        {customBeans.map(bean => (
          <View key={bean.id} style={[styles.beanRow, { borderLeftColor: colors.green }]}>
            <View style={[styles.beanDot, { backgroundColor: colors.green }]} />
            <View style={{ flex: 1 }}>
              <TextInput
                style={styles.customBeanInput}
                value={bean.name}
                onChangeText={t => updateCustomBeanName(bean.id, t)}
                placeholder="Custom bean name…"
                placeholderTextColor={colors.textLight}
                maxLength={32}
              />
              <Text style={styles.beanDesc}>earns 1 bean</Text>
            </View>
            <TouchableOpacity onPress={() => removeCustomBean(bean.id)} style={{ paddingHorizontal: 8 }}>
              <Text style={{ fontSize: 18, color: colors.textLight }}>✕</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addCustomBtn} onPress={addCustomBean} activeOpacity={0.7}>
          <Text style={styles.addCustomText}>+ Add custom bean</Text>
        </TouchableOpacity>

        {!pro && (
          <View style={styles.trialBadgeWrap}>
            <Text style={styles.trialBadge}>
              {roundsLeft > 0 ? `${roundsLeft} free round${roundsLeft === 1 ? '' : 's'} remaining` : 'Free trial complete — upgrade to keep playing'}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.startBtn} onPress={startRound} activeOpacity={0.88}>
          <Text style={styles.startText}>Start Round</Text>
          <Text style={styles.startArrow}>→</Text>
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
                <View style={styles.pickerItem}>
                  <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => selectSavedPlayer(item)}>
                    <View style={styles.pickerAvatar}>
                      <Text style={styles.pickerAvatarText}>{item.slice(0,2).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.pickerItemText}>{item}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => {
                    await deleteSavedPlayer(item);
                    setSavedPlayers(prev => prev.filter(n => n !== item));
                  }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={{ fontSize: 18, color: '#999', paddingHorizontal: 12 }}>✕</Text>
                  </TouchableOpacity>
                </View>
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

      {/* Trial expired modal */}
      <Modal visible={trialExpiredVisible} transparent animationType="fade">
        <View style={styles.promptOverlay}>
          <View style={styles.promptCard}>
            <Text style={styles.trialExpiredEmoji}>⛳</Text>
            <Text style={styles.promptTitle}>Free trial complete</Text>
            <Text style={styles.promptSub}>
              You've played your 3 free rounds. Upgrade to TeeWager Pro to keep playing unlimited rounds and unlock all features.
            </Text>
            <TouchableOpacity
              style={styles.promptSave}
              onPress={() => { setTrialExpiredVisible(false); Linking.openURL('https://www.teewager.io/upgrade'); }}
              activeOpacity={0.85}
            >
              <Text style={styles.promptSaveText}>Upgrade at teewager.io →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.promptSkip} onPress={() => setTrialExpiredVisible(false)}>
              <Text style={styles.promptSkipText}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100 },

  // Hero header
  hero:      { backgroundColor: colors.green, borderRadius: radius.xl, paddingVertical: spacing.xl, paddingHorizontal: spacing.md, marginBottom: spacing.lg, alignItems: 'center', overflow: 'hidden', ...shadow.green },
  heroGlow:  { position: 'absolute', top: -70, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(45,107,68,0.55)' },
  heroEmojiRing: { width: 74, height: 74, borderRadius: 37, backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  heroEmoji: { fontSize: 38 },
  heroTitle: { fontSize: 38, fontWeight: '900', color: colors.white, textAlign: 'center', letterSpacing: -1 },
  heroDivider: { width: 40, height: 3, borderRadius: 2, backgroundColor: colors.goldLight, marginTop: spacing.sm, marginBottom: 2 },
  heroSub:   { fontSize: 13, color: 'rgba(255,255,255,0.78)', textAlign: 'center', marginTop: 6, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1.5 },

  label:   { fontSize: 12, fontWeight: '800', color: colors.textMid, marginTop: spacing.lg, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  row:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },

  // Course search
  courseSearchRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  searchBtn:       { backgroundColor: colors.green, borderRadius: radius.sm, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', minWidth: 80, minHeight: 50 },
  searchBtnText:   { color: colors.white, fontWeight: '800', fontSize: 15 },
  courseAltRow:    { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  altBtn:          { flex: 1, paddingVertical: 13, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white },
  altBtnText:      { fontSize: 14, color: colors.textMid, fontWeight: '600' },
  courseError:     { fontSize: 13, color: colors.red, marginTop: spacing.xs, marginBottom: spacing.xs },
  carryoverRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: spacing.md, marginBottom: 4, backgroundColor: colors.surface, borderRadius: 8, marginLeft: 24 },
  carryoverLabel:  { fontSize: 13, color: colors.textMid },
  recentLabel:     { fontSize: 11, color: colors.textLight, fontWeight: '700', marginTop: spacing.sm, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  recentRow:       { flexDirection: 'row', alignItems: 'center' },
  recentName:      { flex: 1 },
  recentRemove:    { paddingHorizontal: 10, paddingVertical: 8 },
  recentRemoveText:{ fontSize: 14, color: colors.textLight },
  courseResult:    { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.xs, ...shadow.sm },
  courseResultName:{ fontSize: 15, fontWeight: '700', color: colors.textDark },
  courseResultSub: { fontSize: 12, color: colors.textLight, marginTop: 3 },
  courseChip:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: spacing.md, marginBottom: spacing.xs, ...shadow.green },
  courseChipText:  { flex: 1, color: colors.white, fontWeight: '700', fontSize: 14 },
  courseChipClear: { paddingLeft: spacing.sm },
  courseChipClearText: { color: 'rgba(255,255,255,0.8)', fontSize: 18, fontWeight: '700' },

  // Tee selector
  teeBtn:           { flex: 1, paddingVertical: 13, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white },
  teeBtnText:       { fontWeight: '700', color: colors.textDark, fontSize: 14 },
  teeBtnTextActive: { color: colors.white },

  // No results / add course
  noResultsCard:    { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: colors.border, ...shadow.sm },
  noResultsTitle:   { fontSize: 15, fontWeight: '800', color: colors.textDark, marginBottom: 4 },
  noResultsSub:     { fontSize: 13, color: colors.textMid, marginBottom: spacing.sm },
  noResultsRow:     { flexDirection: 'row', gap: spacing.sm },
  noResultsBtn:     { flex: 1, paddingVertical: 12, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white },
  noResultsBtnText: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  customBadge:      { fontSize: 10, fontWeight: '800', color: colors.green, backgroundColor: 'rgba(26,74,46,0.1)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
  addCourseRow:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs, marginBottom: spacing.sm },
  addCourseLink:    { paddingVertical: 8 },
  addCourseLinkText:{ fontSize: 13, color: colors.green, fontWeight: '600' },

  // Manual entry
  manualScanRow:  { marginBottom: spacing.sm },
  scanBtn:        { paddingVertical: 10, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.green, borderStyle: 'dashed', alignItems: 'center' },
  scanBtnText:    { fontSize: 14, fontWeight: '600', color: colors.green },
  manualGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  manualCell:     { width: '18%', backgroundColor: colors.white, borderRadius: radius.sm, padding: spacing.xs, alignItems: 'center', ...shadow.sm },
  manualHoleNum:  { fontSize: 11, color: colors.textLight, fontWeight: '700', marginBottom: 2 },
  manualParRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  manualPar:      { fontSize: 16, fontWeight: '800', color: colors.textDark, minWidth: 18, textAlign: 'center' },
  manualAdj:      { fontSize: 20, color: colors.green, fontWeight: '700', paddingHorizontal: 2 },
  manualYardage:  { fontSize: 10, color: colors.textMid, borderBottomWidth: 1, borderBottomColor: colors.border, textAlign: 'center', width: '100%', marginTop: 3, paddingVertical: 2 },

  countBtn:           { flex: 1, paddingVertical: 15, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.white, ...shadow.sm },
  countBtnActive:     { backgroundColor: colors.green, borderColor: colors.green, ...shadow.green },
  countBtnLocked:     { opacity: 0.45 },
  countBtnText:       { fontWeight: '800', color: colors.textDark, fontSize: 14 },
  countBtnTextActive: { color: colors.white },

  playerInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  input:          { backgroundColor: colors.white, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, fontSize: 16, color: colors.textDark, marginBottom: spacing.sm },
  pickerBtn:      { backgroundColor: colors.green, borderRadius: radius.sm, paddingHorizontal: 16, paddingVertical: 16, justifyContent: 'center', alignItems: 'center' },
  pickerBtnText:  { color: colors.white, fontSize: 18, fontWeight: '700' },

  // Bean rows
  beanRow:      { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderRadius: radius.md, borderLeftWidth: 5, borderLeftColor: colors.green, padding: spacing.md, marginBottom: spacing.sm, gap: spacing.sm, ...shadow.sm },
  beanDot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  beanName:     { fontSize: 15, fontWeight: '700', color: colors.textDark },
  beanProBadge: { fontSize: 10, fontWeight: '800', color: colors.gold, letterSpacing: 0.5 },
  beanValue:    { fontSize: 13, fontWeight: '600', color: colors.green },
  neg:          { color: colors.red },
  beanDesc:     { fontSize: 12, color: colors.textLight, marginTop: 2 },
  customBeanInput: { fontSize: 15, fontWeight: '700', color: colors.textDark, padding: 0, marginBottom: 2 },
  addCustomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: spacing.md, marginBottom: spacing.sm, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.green, borderStyle: 'dashed' },
  addCustomText: { fontSize: 14, fontWeight: '700', color: colors.green },

  // Spots
  spotsWrap:    { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.green, padding: spacing.sm, marginBottom: spacing.sm, ...shadow.sm },
  spotRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  spotName:     { flex: 1, fontSize: 15, fontWeight: '600', color: colors.textDark },
  spotControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spotBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  spotBtnText:  { fontSize: 22, fontWeight: '700', color: colors.green, lineHeight: 24 },
  spotVal:      { width: 36, textAlign: 'center', fontSize: 20, fontWeight: '800', color: colors.textDark },
  spotHint:     { fontSize: 12, color: colors.textLight, marginTop: spacing.sm, textAlign: 'center', lineHeight: 18 },

  // Press options
  pressOptions:     { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gold, padding: spacing.sm, marginBottom: spacing.sm, ...shadow.sm },
  pressOption:      { flexDirection: 'row', alignItems: 'flex-start', padding: spacing.sm, gap: spacing.sm },
  pressRadio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2, flexShrink: 0 },
  pressRadioActive: { borderColor: colors.gold },
  pressRadioDot:    { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.gold },
  pressOptionLabel: { fontSize: 14, fontWeight: '700', color: colors.textDark },
  pressOptionDesc:  { fontSize: 12, color: colors.textLight, marginTop: 2, lineHeight: 18 },

  trialBadgeWrap:    { alignSelf: 'center', backgroundColor: colors.goldPale, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: spacing.md, marginTop: spacing.lg, borderWidth: 1, borderColor: 'rgba(184,134,11,0.25)' },
  trialBadge:        { textAlign: 'center', fontSize: 12.5, fontWeight: '700', color: '#8B6914', letterSpacing: 0.2 },
  trialExpiredEmoji: { fontSize: 44, textAlign: 'center', marginBottom: spacing.sm },
  startBtn:  { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 21, alignItems: 'center', marginTop: spacing.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', ...shadow.green },
  startText: { color: colors.white, fontWeight: '900', fontSize: 19, letterSpacing: 0.5, textTransform: 'uppercase' },
  startArrow: { color: colors.goldLight, fontWeight: '900', fontSize: 20 },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  pickerSheet:      { backgroundColor: colors.white, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, maxHeight: '65%', paddingBottom: 34 },
  pickerHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pickerTitle:      { fontSize: 17, fontWeight: '800', color: colors.textDark },
  pickerClose:      { fontSize: 16, color: colors.green, fontWeight: '700' },
  pickerItem:       { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  pickerAvatar:     { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center' },
  pickerAvatarText: { color: colors.white, fontWeight: '800', fontSize: 15 },
  pickerItemText:   { fontSize: 16, color: colors.textDark, fontWeight: '600' },
  pickerEmpty:      { padding: spacing.lg, textAlign: 'center', color: colors.textLight, fontSize: 15, lineHeight: 24 },

  promptOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  promptCard:     { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, width: '100%', maxWidth: 340, ...shadow.md },
  promptTitle:    { fontSize: 20, fontWeight: '900', color: colors.textDark, marginBottom: spacing.xs },
  promptSub:      { fontSize: 15, color: colors.textMid, marginBottom: spacing.lg, lineHeight: 23 },
  promptSave:     { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 15, alignItems: 'center', marginBottom: spacing.sm, ...shadow.green },
  promptSaveText: { color: colors.white, fontWeight: '800', fontSize: 16 },
  promptSkip:     { paddingVertical: 12, alignItems: 'center' },
  promptSkipText: { color: colors.textMid, fontSize: 15 },
});
