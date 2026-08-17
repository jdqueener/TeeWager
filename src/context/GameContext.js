import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { BEAN_DEFS, DEFAULT_PARS } from '../utils/beans';
import { saveGame, loadGame, clearGame, loadCustomDefs } from '../utils/storage';
import { fetchProfile, ensureProfile, isTrialExpired, trialRoundsLeft } from '../utils/pro';
import { supabase } from '../utils/supabase';

const GameContext = createContext(null);

function makeEmptyScores(playerCount) {
  return Array.from({ length: playerCount }, () =>
    Array.from({ length: 18 }, () => ({}))
  );
}

function makeEmptyStrokes(playerCount) {
  return Array.from({ length: playerCount }, () =>
    Array.from({ length: 18 }, () => 0)
  );
}

// firstBonus tracks round-wide first occurrence per bean type:
// { birdie: { playerIdx, holeIdx }, threePutt: { playerIdx, holeIdx }, ... }
function makeFirstBonus() { return {}; }

const INITIAL_SETUP = {
  phase: 'setup', // 'setup' | 'round'
  players: [],
  beanValue: 1.00,
  enabledBeans: BEAN_DEFS.filter(b => b.free).map(b => b.id),
  customBeans: [],
  scores: [],
  firstBonus: {},
  wagers: [],
  currentHole: 0,
  progressHole: 0,
  strokes: [],
  ldCarryover: 0,
  ldCarryoverLastHole: -1,
  kpCarryover: 0,
  kpCarryoverLastHole: -1,
  skinsCarryover: 0,
  skinsCarryoverLastHole: -1,
  ldCarryoverEnabled: true,
  kpCarryoverEnabled: true,
  bonusBeanDescs: {}, // { [holeIdx]: string }
  pressMode: null,       // null | 'anytime' | 'tenth' | 'perHole'
  presses: [],           // [{holeIdx, value}] — for 'anytime'
  tenthPressed: false,
  tenthPressValue: null, // chosen dollar value for tenth-hole press
  holePresses: {},       // { [holeIdx]: {playerIdxs, value} } — for 'perHole'
  spots: [],             // [number] — bean spots (handicap) per player
  holeCount: 18,   // 9 or 18
  holeOffset: 0,   // 0 = front nine, 9 = back nine (only relevant for 9-hole rounds)
  course: null, // { id, name, tee, totalPar, holes: [{number,par,yardage,handicap}] }
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

    case 'START_ROUND': {
      const { players, beanValue, enabledBeans, customBeans, wagers, course, holeCount = 18, holeOffset = 0, pressMode = null, spots = [], ldCarryoverEnabled = true, kpCarryoverEnabled = true } = action.payload;
      return {
        ...state,
        phase: 'round',
        players,
        beanValue,
        enabledBeans,
        customBeans: customBeans || [],
        wagers: wagers || [],
        course: course || null,
        holeCount,
        holeOffset,
        scores: makeEmptyScores(players.length),
        strokes: makeEmptyStrokes(players.length),
        firstBonus: makeFirstBonus(),
        currentHole: 0,
        progressHole: 0,
        ldCarryover: 0,
        ldCarryoverLastHole: -1,
        kpCarryover: 0,
        kpCarryoverLastHole: -1,
        skinsCarryover: 0,
        skinsCarryoverLastHole: -1,
        ldCarryoverEnabled,
        kpCarryoverEnabled,
        bonusBeanDescs: {},
        pressMode: pressMode || null,
        presses: [],
        tenthPressed: false,
        tenthPressValue: null,
        holePresses: {},
        spots: spots || [],
      };
    }

    case 'SET_HOLE':
      return { ...state, currentHole: action.hole, progressHole: Math.max(state.progressHole, action.hole) };

    case 'SET_STROKE': {
      const { playerIdx, holeIdx, value } = action;
      const strokes = state.strokes.map((p, pi) =>
        pi !== playerIdx ? p : p.map((v, hi) => hi !== holeIdx ? v : Math.max(0, value))
      );
      return { ...state, strokes };
    }

    case 'AWARD_BEAN': {
      const { playerIdx, holeIdx, beanId, delta, bean } = action;
      const scores = state.scores.map((p, pi) =>
        pi !== playerIdx ? p : p.map((h, hi) => {
          if (hi !== holeIdx) return h;
          const cur = h[beanId] || 0;
          const next = Math.max(0, cur + delta);
          return { ...h, [beanId]: next };
        })
      );

      // track first-bonus: round-wide first occurrence per bean type
      let firstBonus = state.firstBonus;
      if (bean?.fb && delta > 0) {
        const cur = state.scores[playerIdx][holeIdx][beanId] || 0;
        if (cur === 0 && firstBonus[beanId] === undefined) {
          // First time this bean type has been awarded all round
          firstBonus = { ...firstBonus, [beanId]: { playerIdx, holeIdx } };
        }
      }
      if (bean?.fb && delta < 0) {
        const cur = state.scores[playerIdx][holeIdx][beanId] || 0;
        const first = firstBonus[beanId];
        if (cur === 1 && first?.playerIdx === playerIdx && first?.holeIdx === holeIdx) {
          // Undoing the round's first occurrence — restore the bonus slot
          const { [beanId]: _removed, ...rest } = firstBonus;
          firstBonus = rest;
        }
      }

      return { ...state, scores, firstBonus };
    }

    case 'SET_FIRST_BIRDIE_BONUS': {
      const { playerIdx, holeIdx } = action;
      return {
        ...state,
        firstBonus: { ...state.firstBonus, birdie: { playerIdx, holeIdx } },
      };
    }

    case 'LD_CARRYOVER':
      if (action.holeIdx <= (state.ldCarryoverLastHole ?? -1)) return state;
      return { ...state, ldCarryover: state.ldCarryover + 1, ldCarryoverLastHole: action.holeIdx };

    case 'LD_AWARD_WITH_CARRYOVER': {
      const { playerIdx, holeIdx, totalBeans: awardBeans } = action;
      let scores = state.scores.map((p) =>
        p.map((h, hi) => hi !== holeIdx ? h : { ...h, longDrive: 0 })
      );
      if (playerIdx >= 0) {
        scores = scores.map((p, pi) =>
          pi !== playerIdx ? p : p.map((h, hi) =>
            hi !== holeIdx ? h : { ...h, longDrive: awardBeans }
          )
        );
      }
      return { ...state, scores, ldCarryover: 0 };
    }

    case 'LD_RESTORE_CARRYOVER':
      return { ...state, ldCarryover: action.value };

    case 'KP_CARRYOVER':
      if (action.holeIdx <= (state.kpCarryoverLastHole ?? -1)) return state;
      return { ...state, kpCarryover: state.kpCarryover + 1, kpCarryoverLastHole: action.holeIdx };

    case 'KP_AWARD_WITH_CARRYOVER': {
      const { playerIdx, holeIdx, totalBeans: awardBeans } = action;
      let scores = state.scores.map((p) =>
        p.map((h, hi) => hi !== holeIdx ? h : { ...h, kp: 0 })
      );
      if (playerIdx >= 0) {
        scores = scores.map((p, pi) =>
          pi !== playerIdx ? p : p.map((h, hi) =>
            hi !== holeIdx ? h : { ...h, kp: awardBeans }
          )
        );
      }
      return { ...state, scores, kpCarryover: 0 };
    }

    case 'KP_RESTORE_CARRYOVER':
      return { ...state, kpCarryover: action.value };

    case 'SKINS_CARRYOVER':
      if (action.holeIdx <= (state.skinsCarryoverLastHole ?? -1)) return state;
      return { ...state, skinsCarryover: state.skinsCarryover + 1, skinsCarryoverLastHole: action.holeIdx };

    case 'SKINS_AWARD': {
      const { playerIdx, holeIdx, totalBeans: awardBeans } = action;
      let scores = state.scores.map(p =>
        p.map((h, hi) => hi !== holeIdx ? h : { ...h, lowBall: 0 })
      );
      if (playerIdx >= 0) {
        scores = scores.map((p, pi) =>
          pi !== playerIdx ? p : p.map((h, hi) =>
            hi !== holeIdx ? h : { ...h, lowBall: awardBeans }
          )
        );
      }
      return { ...state, scores, skinsCarryover: 0 };
    }

    case 'SKINS_RESTORE_CARRYOVER':
      return { ...state, skinsCarryover: action.value };

    case 'SET_WAGER_WINNER': {
      const wagers = state.wagers.map((w, i) =>
        i === action.wagerIdx ? { ...w, winnerId: action.winnerId } : w
      );
      return { ...state, wagers };
    }

    case 'ADD_PRESS':
      return { ...state, presses: [...state.presses, { holeIdx: action.holeIdx, value: action.value }] };

    case 'PRESS_TENTH':
      return { ...state, tenthPressed: true, tenthPressValue: action.value };

    case 'ADD_HOLE_PRESS':
      return { ...state, holePresses: { ...state.holePresses, [action.holeIdx]: { playerIdxs: action.playerIdxs, value: action.value } } };

    case 'REMOVE_HOLE_PRESS': {
      const { [action.holeIdx]: _removed, ...restPresses } = state.holePresses;
      return { ...state, holePresses: restPresses };
    }

    case 'SET_BONUS_DESC': {
      const { holeIdx, desc } = action;
      return { ...state, bonusBeanDescs: { ...state.bonusBeanDescs, [holeIdx]: desc } };
    }

    case 'RESET':
      return { ...INITIAL_SETUP, customBeans: state.customBeans };

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_SETUP);
  const [pro, setPro] = useState(false);
  const [profile, setProfile] = useState({ is_pro: false, rounds_completed: 0 });
  const [loading, setLoading] = useState(true);

  async function refreshProfile(userId) {
    if (!userId) return;
    await ensureProfile(userId);
    const p = await fetchProfile(userId);
    setProfile(p);
    setPro(!!p.is_pro);
  }

  useEffect(() => {
    (async () => {
      const [saved, customs] = await Promise.all([loadGame(), loadCustomDefs()]);
      if (saved) dispatch({ type: 'LOAD', payload: { ...saved, customBeans: customs } });
      else if (customs.length) dispatch({ type: 'LOAD', payload: { ...INITIAL_SETUP, customBeans: customs } });

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) await refreshProfile(session.user.id);

      setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) refreshProfile(session.user.id);
      else { setProfile({ is_pro: false, rounds_completed: 0 }); setPro(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // auto-save whenever round state changes; clear on reset
  useEffect(() => {
    if (loading) return;
    if (state.phase === 'round') saveGame(state);
    else clearGame();
  }, [state, loading]);

  const allBeans = [...BEAN_DEFS, ...(state.customBeans || [])];
  const activeBeans = allBeans.filter(b => b.impromptu || state.enabledBeans.includes(b.id));

  function getHolePar(holeIdx) {
    const offset = state.holeOffset ?? 0;
    return state.course?.holes?.[offset + holeIdx]?.par ?? DEFAULT_PARS[offset + holeIdx];
  }

  const canPlay = pro || !isTrialExpired(profile);
  const roundsLeft = trialRoundsLeft(profile);

  return (
    <GameContext.Provider value={{ state, dispatch, pro, setPro, profile, setProfile, refreshProfile, canPlay, roundsLeft, loading, allBeans, activeBeans, getHolePar }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
