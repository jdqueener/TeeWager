// Nassau Golf Game — pure logic, no UI dependencies
//
// Terminology:
//   strokes[playerIdx][holeIdx] = gross stroke count (0 = not entered)
//   leg = 'front' | 'back' | 'total'
//   hole indices 0-8 = front nine, 9-17 = back nine

// ─── Hole result ────────────────────────────────────────────────────────────

// Returns the winner index for a single hole, or -1 for a halve.
// Only considers players with a recorded stroke (> 0).
export function holeWinner(strokes, playerIdxs, holeIdx) {
  const valid = playerIdxs.filter(pi => (strokes[pi]?.[holeIdx] ?? 0) > 0);
  if (valid.length === 0) return null; // not yet played
  const min = Math.min(...valid.map(pi => strokes[pi][holeIdx]));
  const winners = valid.filter(pi => strokes[pi][holeIdx] === min);
  return winners.length === 1 ? winners[0] : -1; // -1 = halved
}

// ─── Leg standings ───────────────────────────────────────────────────────────

// Returns { wins, halves, losses, holesPlayed } for each player in a leg.
// playerIdxs: array of player indices taking part (all players for round-robin).
// holeRange: array of hole indices for this leg.
//
// For > 2 players we compute round-robin: each hole pits every player against
// every other player. A player's "wins" = number of head-to-head hole wins.
// This lets Nassau work naturally with 3-4 players.

export function legStandings(strokes, playerIdxs, holeRange) {
  const n = playerIdxs.length;
  const wins   = Object.fromEntries(playerIdxs.map(pi => [pi, 0]));
  const halves = Object.fromEntries(playerIdxs.map(pi => [pi, 0]));
  const losses = Object.fromEntries(playerIdxs.map(pi => [pi, 0]));
  let holesPlayed = 0;

  for (const h of holeRange) {
    // Skip holes where any player hasn't entered a score yet
    const allEntered = playerIdxs.every(pi => (strokes[pi]?.[h] ?? 0) > 0);
    if (!allEntered) continue;
    holesPlayed++;

    if (n === 2) {
      const [a, b] = playerIdxs;
      const sa = strokes[a][h], sb = strokes[b][h];
      if (sa < sb)      { wins[a]++; losses[b]++; }
      else if (sb < sa) { wins[b]++; losses[a]++; }
      else              { halves[a]++; halves[b]++; }
    } else {
      // Round-robin: each pair
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const a = playerIdxs[i], b = playerIdxs[j];
          const sa = strokes[a][h], sb = strokes[b][h];
          if (sa < sb)      { wins[a]++; losses[b]++; }
          else if (sb < sa) { wins[b]++; losses[a]++; }
          else              { halves[a]++; halves[b]++; }
        }
      }
    }
  }

  return { wins, halves, losses, holesPlayed };
}

// ─── Leg match status ────────────────────────────────────────────────────────

// Returns a human-readable match status string for a 2-player leg.
// e.g. "BV 3 UP", "All Square", "JQ 1 UP (2 to play)"
export function legMatchStatus(strokes, playerIdxs, holeRange, playerNames) {
  if (playerIdxs.length !== 2) return '';
  const { wins, holesPlayed } = legStandings(strokes, playerIdxs, holeRange);
  const [a, b] = playerIdxs;
  const diff = wins[a] - wins[b];
  const remaining = holeRange.length - holesPlayed;

  if (diff === 0) {
    return holesPlayed === 0 ? 'Not started' : 'All Square';
  }
  const leader = diff > 0 ? a : b;
  const margin = Math.abs(diff);
  const name = playerNames[leader].split(' ')[0];

  if (remaining === 0) return `${name} wins ${margin} UP`;
  if (margin > remaining) return `${name} ${margin} UP (closed)`; // dormie-like
  return `${name} ${margin} UP (${remaining} to play)`;
}

// ─── Press helpers ───────────────────────────────────────────────────────────

// Returns true if any player in a 2-player match can press the leg.
// legPresses: array of { startHole } already declared for this leg.
// currentHole: 0-based index of the hole being played NOW (not yet scored).
export function canPressLeg(strokes, playerIdxs, legRange, legPresses, currentHole) {
  if (playerIdxs.length !== 2) return false;
  const remaining = legRange.filter(h => h >= currentHole).length;
  if (remaining <= 0) return false;

  // Active match runs from the last press start (or leg start) up through
  // holes already completed (< currentHole).
  const lastPress = legPresses[legPresses.length - 1];
  const activeStart = lastPress ? lastPress.startHole : legRange[0];
  const completedRange = legRange.filter(h => h >= activeStart && h < currentHole);
  if (completedRange.length === 0) return false;

  const { wins } = legStandings(strokes, playerIdxs, completedRange);
  const [a, b] = playerIdxs;
  return Math.abs(wins[a] - wins[b]) >= 2;
}

// Returns the human-readable status of the CURRENT active match for a leg,
// i.e. from the last press start (or full leg start) to end of leg.
export function activeLegStatus(strokes, playerIdxs, legRange, legPresses, playerNames) {
  const lastPress = legPresses[legPresses.length - 1];
  const activeStart = lastPress ? lastPress.startHole : legRange[0];
  const activeRange = legRange.filter(h => h >= activeStart);
  return legMatchStatus(strokes, playerIdxs, activeRange, playerNames);
}

// ─── Settlement ──────────────────────────────────────────────────────────────

// Settles a single range (original leg or a press slice) into net[].
function settleLegRange(net, strokes, playerIdxs, range, stake) {
  const n = playerIdxs.length;
  if (n === 2) {
    const { wins } = legStandings(strokes, playerIdxs, range);
    const [a, b] = playerIdxs;
    const diff = wins[a] - wins[b];
    if (diff > 0) { net[a] += stake; net[b] -= stake; }
    else if (diff < 0) { net[b] += stake; net[a] -= stake; }
  } else {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const { wins } = legStandings(strokes, [i, j], range);
        const diff = wins[i] - wins[j];
        if (diff > 0) { net[i] += stake; net[j] -= stake; }
        else if (diff < 0) { net[j] += stake; net[i] -= stake; }
      }
    }
  }
}

// Computes net dollar transfers for a Nassau round, including any presses.
// nassauPresses: { front: [{startHole}], back: [...], total: [...] }
//
// Each press creates an additional bet covering startHole → end of leg,
// settled at the same nassauStake as the original leg.
export function computeNassauSettleUp(players, strokes, nassauStake, holeCount = 18, nassauPresses = {}) {
  const n = players.length;
  const playerIdxs = players.map((_, i) => i);

  const frontRange = Array.from({ length: 9 }, (_, i) => i);
  const backRange  = Array.from({ length: Math.min(9, holeCount - 9) }, (_, i) => i + 9);
  const totalRange = Array.from({ length: holeCount }, (_, i) => i);

  const legDefs = holeCount >= 18
    ? [['front', frontRange], ['back', backRange], ['total', totalRange]]
    : [['front', frontRange]];

  const net = new Array(n).fill(0);

  for (const [legKey, range] of legDefs) {
    // Original leg
    settleLegRange(net, strokes, playerIdxs, range, nassauStake);
    // Each press
    for (const press of (nassauPresses[legKey] || [])) {
      const pressRange = range.filter(h => h >= press.startHole);
      if (pressRange.length > 0) settleLegRange(net, strokes, playerIdxs, pressRange, nassauStake);
    }
  }

  return minimumCashFlowNassau(players, net);
}

// Minimum cash flow — same algorithm as beans.js but self-contained here
// so nassau.js has no cross-dependency on beans.js.
function minimumCashFlowNassau(players, net) {
  const n = players.length;
  const settled = net.map((amt, i) => ({ i, amt }));
  const payments = [];

  for (let round = 0; round < n * n; round++) {
    settled.sort((a, b) => a.amt - b.amt);
    const debtor  = settled[0];
    const creditor = settled[n - 1];
    if (Math.abs(debtor.amt) < 0.001 || Math.abs(creditor.amt) < 0.001) break;
    const transfer = Math.min(-debtor.amt, creditor.amt);
    payments.push({ from: debtor.i, to: creditor.i, amt: Math.round(transfer * 100) / 100 });
    debtor.amt   += transfer;
    creditor.amt -= transfer;
  }

  return payments;
}

// ─── Hole-by-hole match status for all legs (used in scoring UI) ─────────────

// Returns { front, back, total } each with { standing, holesRemaining }
// standing: positive = player 0 leads, negative = player 1 leads (2-player only)
export function nassauMatchSummary(strokes, players, holeCount = 18) {
  const playerIdxs = players.map((_, i) => i);
  const frontRange = Array.from({ length: 9 }, (_, i) => i);
  const backRange  = holeCount >= 18 ? Array.from({ length: 9 }, (_, i) => i + 9) : [];
  const totalRange = Array.from({ length: holeCount }, (_, i) => i);

  return {
    front: legStandings(strokes, playerIdxs, frontRange),
    back:  legStandings(strokes, playerIdxs, backRange),
    total: legStandings(strokes, playerIdxs, totalRange),
  };
}
