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

function minimumCashFlow(players, net) {
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
