import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { BEAN_DEFS, DEFAULT_PARS } from '../utils/beans';
import { saveGame, loadGame, clearGame, isPro as checkPro, loadCustomDefs } from '../utils/storage';

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
  strokes: [],
  ldCarryover: 0,
  kpCarryover: 0,
  holeCount: 18,   // 9 or 18
  holeOffset: 0,   // 0 = front nine, 9 = back nine (only relevant for 9-hole rounds)
  course: null, // { id, name, tee, totalPar, holes: [{number,par,yardage,handicap}] }
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

    case 'START_ROUND': {
      const { players, beanValue, enabledBeans, wagers, course, holeCount = 18, holeOffset = 0 } = action.payload;
      return {
        ...state,
        phase: 'round',
        players,
        beanValue,
        enabledBeans,
        wagers: wagers || [],
        course: course || null,
        holeCount,
        holeOffset,
        scores: makeEmptyScores(players.length),
        strokes: makeEmptyStrokes(players.length),
        firstBonus: makeFirstBonus(),
        currentHole: 0,
        ldCarryover: 0,
        kpCarryover: 0,
      };
    }

    case 'SET_HOLE':
      return { ...state, currentHole: action.hole };

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

    case 'LD_CARRYOVER':
      return { ...state, ldCarryover: state.ldCarryover + 1 };

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
      return { ...state, kpCarryover: state.kpCarryover + 1 };

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

    case 'SET_WAGER_WINNER': {
      const wagers = state.wagers.map((w, i) =>
        i === action.wagerIdx ? { ...w, winnerId: action.winnerId } : w
      );
      return { ...state, wagers };
    }

    case 'RESET':
      return { ...INITIAL_SETUP, customBeans: state.customBeans };

    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_SETUP);
  const [pro, setPro] = useState(true); // TODO: revert to false when Stripe is live
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [saved, customs] = await Promise.all([
        loadGame(),
        loadCustomDefs(),
      ]);
      if (saved) dispatch({ type: 'LOAD', payload: { ...saved, customBeans: customs } });
      else if (customs.length) dispatch({ type: 'LOAD', payload: { ...INITIAL_SETUP, customBeans: customs } });
      setPro(true); // TODO: revert to checkPro() when Stripe is live
      setLoading(false);
    })();
  }, []);

  // auto-save whenever round state changes; clear on reset
  useEffect(() => {
    if (loading) return;
    if (state.phase === 'round') saveGame(state);
    else clearGame();
  }, [state, loading]);

  const allBeans = [...BEAN_DEFS, ...(state.customBeans || [])];
  const activeBeans = allBeans.filter(b => state.enabledBeans.includes(b.id));

  function getHolePar(holeIdx) {
    const offset = state.holeOffset ?? 0;
    return state.course?.holes?.[offset + holeIdx]?.par ?? DEFAULT_PARS[offset + holeIdx];
  }

  return (
    <GameContext.Provider value={{ state, dispatch, pro, setPro, loading, allBeans, activeBeans, getHolePar }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
