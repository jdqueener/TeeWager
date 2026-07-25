export const DEFAULT_PARS = [4,3,5,4,4,3,5,4,4,4,5,3,4,4,3,5,4,4];

export const BEAN_DEFS = [
  { id: 'lowBall',   name: 'Low Ball',   v: 1, pf: null,  fb: false, free: true, solo: true, desc: 'Low score wins; ties carry over', skins: true },
  { id: 'longDrive', name: 'Long Drive', v: 1, pf: [4,5], fb: false, free: true, solo: true, desc: 'Best drive on hole' },
  { id: 'kp',        name: 'KP',         v: 1, pf: [3],   fb: false, free: true, solo: true, desc: 'Closest to pin' },
  { id: 'birdie',    name: 'Birdie',     v: 1, pf: null,  fb: true,  free: true, desc: 'First birdie earns 2' },
  { id: 'eagle',     name: 'Eagle',      v: 4, pf: null,  fb: false, free: true, desc: '' },
  { id: 'threePutt', name: '3-Putt',     v: 1, pf: null,  fb: true,  free: true, awardToOthers: true, desc: 'First awards 2 to each; then 1 each' },
  { id: 'holeInOne', name: 'Hole in One',v:20, pf: null,  fb: false, free: false, desc: '' },
  { id: 'dblEagle',  name: 'Double Eagle',v:40,pf: [5],   fb: false, free: false, desc: '' },
  { id: 'sandyBird', name: 'Sandy Birdie',v:2, pf: null,  fb: false, free: false, desc: 'Birdie after sand' },
  { id: 'sandyPar',  name: 'Sandy Par',  v: 1, pf: null,  fb: false, free: true,  desc: 'Par after sand' },
  { id: 'twoTreePar',name: '2-Tree Par', v: 2, pf: null,  fb: false, free: false, desc: 'Par after 2 trees' },
  { id: 'teeStick',  name: 'Tee Sticks Up',v:1,pf: null,  fb: false, free: false, desc: 'Tee flips back in' },
  { id: 'flagLength',name: 'Flag Length +',v:1,pf: null,  fb: false, free: false, desc: 'Long putt made' },
  { id: 'fourPutt',  name: '4-Putt',     v: 2, pf: null,  fb: false, free: true,  awardToOthers: true, desc: 'Awards 2 beans to each other player' },
  { id: 'chipIn',    name: 'Chip In',    v: 1, pf: null,  fb: false, free: true,  desc: 'Hole out from off the green' },
  { id: 'bonusBean', name: 'Bonus Bean', v: 1, pf: null,  fb: false, free: true,  impromptu: true, desc: 'In-round challenge bean' },
];

export function beanLabel(value, awardToOthers = false) {
  const abs = Math.abs(value);
  const noun = abs === 1 ? 'bean' : 'beans';
  if (awardToOthers) return `costs ${abs} ${noun} each`;
  return value >= 0 ? `earns ${value} ${noun}` : `costs ${abs} ${noun}`;
}

export function isParAllowed(bean, par) {
  if (!bean.pf) return true;
  return bean.pf.includes(par);
}

export function getEffectiveValue(bean, playerIdx, holeIdx, firstBonus) {
  if (!bean.fb) return bean.v;
  const first = firstBonus?.[bean.id];
  if (first && first.playerIdx === playerIdx && first.holeIdx === holeIdx) return bean.v * 2;
  return bean.v;
}

export function totalBeansForPlayer(playerIdx, scores, activeBeans, firstBonus) {
  let total = 0;
  const playerCount = scores.length;
  for (let h = 0; h < 18; h++) {
    for (const bean of activeBeans) {
      if (bean.awardToOthers) {
        // Each other player's event awards beans to this player
        for (let op = 0; op < playerCount; op++) {
          if (op === playerIdx) continue;
          const count = scores[op]?.[h]?.[bean.id] || 0;
          if (!count) continue;
          total += count * Math.abs(getEffectiveValue(bean, op, h, firstBonus));
        }
      } else {
        const count = scores[playerIdx]?.[h]?.[bean.id] || 0;
        total += count * getEffectiveValue(bean, playerIdx, h, firstBonus);
      }
    }
  }
  return total;
}

// Returns effective bean dollar value at a given hole, accounting for press multipliers.
// presses entries: { holeIdx, value } — value is the chosen pressed amount.
// holePresses entries: { playerIdxs, value }
export function getEffectiveBeanValue(beanValue, holeIdx, pressMode, presses, tenthPressed, tenthPressValue) {
  if (pressMode === 'anytime') {
    const active = (presses || []).filter(p => p.holeIdx <= holeIdx);
    if (!active.length) return beanValue;
    return active.reduce((a, b) => b.holeIdx > a.holeIdx ? b : a).value ?? beanValue * 2;
  }
  if (pressMode === 'tenth' && tenthPressed && holeIdx >= 9) {
    return tenthPressValue ?? beanValue * 2;
  }
  return beanValue;
}

// Beans earned by a player on a single hole (respects awardToOthers)
export function beansAtHoleForPlayer(playerIdx, holeIdx, scores, activeBeans, firstBonus, playerCount) {
  let total = 0;
  for (const bean of activeBeans) {
    if (bean.awardToOthers) {
      for (let op = 0; op < playerCount; op++) {
        if (op === playerIdx) continue;
        const count = scores[op]?.[holeIdx]?.[bean.id] || 0;
        if (!count) continue;
        total += count * Math.abs(getEffectiveValue(bean, op, holeIdx, firstBonus));
      }
    } else {
      const count = scores[playerIdx]?.[holeIdx]?.[bean.id] || 0;
      total += count * getEffectiveValue(bean, playerIdx, holeIdx, firstBonus);
    }
  }
  return total;
}

// Press-aware settlement: handles all three press modes
export function computePressSettleUp(players, scores, activeBeans, firstBonus, beanValue, pressState, wagers, holeCount = 18) {
  const { pressMode, presses, tenthPressed, tenthPressValue, holePresses } = pressState || {};
  const n = players.length;

  const net = players.map((_, pi) => {
    let dollars = 0;
    for (let h = 0; h < holeCount; h++) {
      const effValue = getEffectiveBeanValue(beanValue, h, pressMode, presses, tenthPressed, tenthPressValue);
      const myBeans = beansAtHoleForPlayer(pi, h, scores, activeBeans, firstBonus, n);
      const totalHoleBeans = players.reduce((s, _, qi) =>
        s + beansAtHoleForPlayer(qi, h, scores, activeBeans, firstBonus, n), 0);
      dollars += effValue * (myBeans * n - totalHoleBeans);

      // Per-hole press: additional side bet between pressed players only
      const holePress = holePresses?.[h];
      if (pressMode === 'perHole' && holePress?.playerIdxs?.includes(pi)) {
        const { playerIdxs, value: pressVal = beanValue } = holePress;
        const np = playerIdxs.length;
        const myPB = beansAtHoleForPlayer(pi, h, scores, activeBeans, firstBonus, n);
        const totalPB = playerIdxs.reduce((s, qi) =>
          s + beansAtHoleForPlayer(qi, h, scores, activeBeans, firstBonus, n), 0);
        dollars += pressVal * (myPB * np - totalPB);
      }
    }
    return dollars;
  });

  (wagers || []).forEach(w => {
    if (w.winnerId >= 0) {
      players.forEach((_, pi) => {
        if (pi !== w.winnerId) {
          net[w.winnerId] += w.amt;
          net[pi] -= w.amt;
        }
      });
    }
  });

  return minimumCashFlow(players, net);
}

export function computeSettleUp(players, beanTotals, beanValue, wagers = []) {
  // Each bean earned costs every other player $beanValue directly.
  // net[i] = beanValue * (myBeans * N - totalBeans)
  const n = players.length;
  const totalBeans = beanTotals.reduce((a, b) => a + b, 0);
  const adj = beanTotals.map(t => beanValue * (t * n - totalBeans));

  // add wager outcomes
  wagers.forEach(w => {
    if (w.winnerId >= 0) {
      players.forEach((_, pi) => {
        if (pi !== w.winnerId) {
          adj[w.winnerId] += w.amt;
          adj[pi] -= w.amt;
        }
      });
    }
  });

  return minimumCashFlow(players, adj);
}

export function minimumCashFlow(players, net) {
  const payments = [];
  const bal = net.map((v, i) => ({ i, v: Math.round(v * 100) / 100 }));

  for (let iter = 0; iter < 100; iter++) {
    const maxCred = bal.reduce((a, b) => (b.v > a.v ? b : a));
    const maxDeb  = bal.reduce((a, b) => (b.v < a.v ? b : a));
    if (Math.abs(maxCred.v) < 0.01 || Math.abs(maxDeb.v) < 0.01) break;
    const amt = Math.min(maxCred.v, -maxDeb.v);
    payments.push({ from: maxDeb.i, to: maxCred.i, amt: Math.round(amt * 100) / 100 });
    maxCred.v -= amt;
    maxDeb.v  += amt;
  }
  return payments;
}
