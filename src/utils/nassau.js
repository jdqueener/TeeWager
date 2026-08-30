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

// ─── Settlement ──────────────────────────────────────────────────────────────

// Computes net dollar transfers for a Nassau round.
// Returns same shape as computePressSettleUp: [{ from, to, amt }]
//
// For 2 players: straightforward — each leg winner collects stake from loser.
// For 3-4 players (round-robin): each head-to-head pair settles each leg
//   independently. This means up to n*(n-1)/2 * 3 individual payments,
//   collapsed via minimumCashFlow.

export function computeNassauSettleUp(players, strokes, nassauStake, holeCount = 18) {
  const n = players.length;
  const playerIdxs = players.map((_, i) => i);

  const frontRange = Array.from({ length: 9 }, (_, i) => i);
  const backRange  = Array.from({ length: Math.min(9, holeCount - 9) }, (_, i) => i + 9);
  const totalRange = Array.from({ length: holeCount }, (_, i) => i);

  // Only include back range if playing 18
  const legs = holeCount >= 18
    ? [frontRange, backRange, totalRange]
    : [frontRange]; // 9-hole Nassau = front leg only

  const net = new Array(n).fill(0);

  for (const range of legs) {
    if (n === 2) {
      const { wins } = legStandings(strokes, playerIdxs, range);
      const [a, b] = playerIdxs;
      const diff = wins[a] - wins[b];
      if (diff > 0) { net[a] += nassauStake; net[b] -= nassauStake; }
      else if (diff < 0) { net[b] += nassauStake; net[a] -= nassauStake; }
      // diff === 0: halved leg, no money moves
    } else {
      // Round-robin pairs
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const { wins } = legStandings(strokes, [i, j], range);
          const diff = wins[i] - wins[j];
          if (diff > 0) { net[i] += nassauStake; net[j] -= nassauStake; }
          else if (diff < 0) { net[j] += nassauStake; net[i] -= nassauStake; }
        }
      }
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
