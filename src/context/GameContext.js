import React, { createContext, useContext, useEffect, useReducer, useState } from 'react';
import { BEAN_DEFS } from '../utils/beans';
import { saveGame, loadGame, clearGame, isPro as checkPro, loadCustomDefs } from '../utils/storage';

const GameContext = createContext(null);

function makeEmptyScores(playerCount) {
  return Array.from({ length: playerCount }, () =>
    Array.from({ length: 18 }, () => ({}))
  );
}

function makeFirstBonus(playerCount) {
  return Object.fromEntries(
    Array.from({ length: playerCount }, (_, i) => [i, {}])
  );
}

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
  ldCarryover: 0, // accumulated Long Drive carryover beans
};

function reducer(state, action) {
  switch (action.type) {
    case 'LOAD':
      return action.payload;

    case 'START_ROUND': {
      const { players, beanValue, enabledBeans, wagers } = action.payload;
      return {
        ...state,
        phase: 'round',
        players,
        beanValue,
        enabledBeans,
        wagers: wagers || [],
        scores: makeEmptyScores(players.length),
        firstBonus: makeFirstBonus(players.length),
        currentHole: 0,
      };
    }

    case 'SET_HOLE':
      return { ...state, currentHole: action.hole };

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

      // track first-bonus: when count goes from 0 to 1
      let firstBonus = state.firstBonus;
      const key = beanId + '_f';
      if (bean?.fb && delta > 0) {
        const cur = state.scores[playerIdx][holeIdx][beanId] || 0;
        if (cur === 0 && firstBonus[playerIdx][key] === undefined) {
          firstBonus = {
            ...firstBonus,
            [playerIdx]: { ...firstBonus[playerIdx], [key]: holeIdx },
          };
        }
      }
      // if decrementing removes the first occurrence, clear it
      if (bean?.fb && delta < 0) {
        const cur = state.scores[playerIdx][holeIdx][beanId] || 0;
        if (cur === 1 && firstBonus[playerIdx][key] === holeIdx) {
          firstBonus = {
            ...firstBonus,
            [playerIdx]: { ...firstBonus[playerIdx], [key]: undefined },
          };
        }
      }

      return { ...state, scores, firstBonus };
    }

    case 'LD_CARRYOVER':
      return { ...state, ldCarryover: state.ldCarryover + 1 };

    case 'LD_AWARD_WITH_CARRYOVER': {
      // Award Long Drive to one player with accumulated carryover, then reset
      const { playerIdx, holeIdx, totalBeans: awardBeans } = action;
      // First clear any existing long drive awards on this hole
      let scores = state.scores.map((p, pi) =>
        p.map((h, hi) => hi !== holeIdx ? h : { ...h, longDrive: 0 })
      );
      // Award the winner with 1 + carryover count
      scores = scores.map((p, pi) =>
        pi !== playerIdx ? p : p.map((h, hi) =>
          hi !== holeIdx ? h : { ...h, longDrive: awardBeans }
        )
      );
      return { ...state, scores, ldCarryover: 0 };
    }

    case 'LD_RESET_CARRYOVER':
      return { ...state, ldCarryover: 0 };

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
  const [pro, setPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [saved, proVal, customs] = await Promise.all([
        loadGame(),
        checkPro(),
        loadCustomDefs(),
      ]);
      if (saved) dispatch({ type: 'LOAD', payload: { ...saved, customBeans: customs } });
      else if (customs.length) dispatch({ type: 'LOAD', payload: { ...INITIAL_SETUP, customBeans: customs } });
      setPro(proVal);
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

  return (
    <GameContext.Provider value={{ state, dispatch, pro, setPro, loading, allBeans, activeBeans }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be inside GameProvider');
  return ctx;
}
