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
    if (holesPlayed === 0) return 'Not started';
    return remaining === 0 ? 'Match Halved' : 'All Square';
  }
  const leader = diff > 0 ? a : b;
  const margin = Math.abs(diff);
  const name = playerNames[leader].split(' ')[0];

  if (remaining === 0) return `${name} wins ${margin} UP`;
  if (margin > remaining) return `${name} ${margin} UP (closed)`; // dormie-like
  return `${name} ${margin} UP (${remaining} to play)`;
}

// ─── Team (2v2) best-ball logic ─────────────────────────────────────────────

// Best ball for a team on a single hole — lowest score among players who have entered.
export function teamBestBall(strokes, teamPlayers, holeIdx) {
  const valid = teamPlayers.filter(pi => (strokes[pi]?.[holeIdx] ?? 0) > 0);
  if (valid.length === 0) return null;
  return Math.min(...valid.map(pi => strokes[pi][holeIdx]));
}

// Hole-by-hole best-ball standings for two teams over a hole range.
export function legStandingsTeam(strokes, teamA, teamB, holeRange) {
  let winsA = 0, winsB = 0, halves = 0, holesPlayed = 0;
  for (const h of holeRange) {
    const bbA = teamBestBall(strokes, teamA, h);
    const bbB = teamBestBall(strokes, teamB, h);
    if (bbA === null || bbB === null) continue;
    holesPlayed++;
    if (bbA < bbB) winsA++;
    else if (bbB < bbA) winsB++;
    else halves++;
  }
  return { winsA, winsB, halves, holesPlayed };
}

// Human-readable match status for a 2v2 team leg.
// teamNames: [nameForTeamA, nameForTeamB]
export function legMatchStatusTeam(strokes, teamA, teamB, holeRange, teamNames) {
  const { winsA, winsB, holesPlayed } = legStandingsTeam(strokes, teamA, teamB, holeRange);
  const diff = winsA - winsB;
  const remaining = holeRange.length - holesPlayed;
  if (holesPlayed === 0) return 'Not started';
  if (diff === 0) return remaining === 0 ? 'Match Halved' : 'All Square';
  const leader = diff > 0 ? teamNames[0] : teamNames[1];
  const margin = Math.abs(diff);
  if (remaining === 0) return `${leader} wins ${margin} UP`;
  if (margin > remaining) return `${leader} ${margin} UP (closed)`;
  return `${leader} ${margin} UP (${remaining} to play)`;
}

// Press eligibility for a 2v2 team leg.
export function canPressTeam(strokes, teamA, teamB, legRange, legPresses, currentHole) {
  const remaining = legRange.filter(h => h >= currentHole).length;
  if (remaining <= 0) return false;
  const lastPress = legPresses[legPresses.length - 1];
  const activeStart = lastPress ? lastPress.startHole : legRange[0];
  const completedRange = legRange.filter(h => h >= activeStart && h < currentHole);
  if (completedRange.length === 0) return false;
  const { winsA, winsB } = legStandingsTeam(strokes, teamA, teamB, completedRange);
  return Math.abs(winsA - winsB) >= 2;
}

// Status of the current active match (last press range, or full leg) for teams.
export function activeLegStatusTeam(strokes, teamA, teamB, legRange, legPresses, teamNames) {
  const lastPress = legPresses[legPresses.length - 1];
  const activeStart = lastPress ? lastPress.startHole : legRange[0];
  const activeRange = legRange.filter(h => h >= activeStart);
  return legMatchStatusTeam(strokes, teamA, teamB, activeRange, teamNames);
}

// Settlement for team Nassau. Each leg winner team collects nassauStake total;
// each member of the winning team receives stake/2, each loser pays stake/2.
export function computeNassauSettleUpTeam(players, teams, strokes, nassauStake, holeCount = 18, nassauPresses = {}) {
  const [teamA, teamB] = teams;
  const frontRange = Array.from({ length: 9 }, (_, i) => i);
  const backRange  = Array.from({ length: Math.min(9, holeCount - 9) }, (_, i) => i + 9);
  const totalRange = Array.from({ length: holeCount }, (_, i) => i);
  const legDefs = holeCount >= 18
    ? [['front', frontRange], ['back', backRange], ['total', totalRange]]
    : [['front', frontRange]];

  const net = new Array(players.length).fill(0);

  function settleTeamRange(range, stake) {
    const { winsA, winsB } = legStandingsTeam(strokes, teamA, teamB, range);
    const diff = winsA - winsB;
    if (diff > 0) {
      for (const pi of teamA) net[pi] += stake / 2;
      for (const pi of teamB) net[pi] -= stake / 2;
    } else if (diff < 0) {
      for (const pi of teamB) net[pi] += stake / 2;
      for (const pi of teamA) net[pi] -= stake / 2;
    }
  }

  for (const [legKey, range] of legDefs) {
    settleTeamRange(range, nassauStake);
    for (const press of (nassauPresses[legKey] || [])) {
      const pressRange = range.filter(h => h >= press.startHole);
      if (pressRange.length > 0) settleTeamRange(pressRange, nassauStake);
    }
  }

  return minimumCashFlowNassau(players, net);
}

// ─── 2v2 sub-format helpers ──────────────────────────────────────────────────

// Combined: team score per hole = sum of both team members' strokes.
export function teamCombined(strokes, teamPlayers, holeIdx) {
  const valid = teamPlayers.filter(pi => (strokes[pi]?.[holeIdx] ?? 0) > 0);
  if (valid.length < teamPlayers.length) return null; // need all players scored
  return valid.reduce((s, pi) => s + strokes[pi][holeIdx], 0);
}

// Scramble: team uses one ball — lowest score among team members per hole.
// (Players should enter the shared scramble score; min handles slight entry differences.)
export function teamScramble(strokes, teamPlayers, holeIdx) {
  return teamBestBall(strokes, teamPlayers, holeIdx); // same math as best ball
}

// Per-hole result for a 2v2 team format (match-play/best-ball, combined, or scramble).
// winner: 0 = teamA, 1 = teamB, -1 = halved, null = hole not yet fully scored.
export function holeResultTeam(strokes, teamA, teamB, holeIdx, teamFormat = 'match-play') {
  const scorer = teamFormat === 'combined' ? teamCombined : teamBestBall; // best-ball & scramble share the min-score scorer
  const scoreA = scorer(strokes, teamA, holeIdx);
  const scoreB = scorer(strokes, teamB, holeIdx);
  if (scoreA === null || scoreB === null) return { scoreA, scoreB, winner: null };
  if (scoreA === scoreB) return { scoreA, scoreB, winner: -1 };
  return { scoreA, scoreB, winner: scoreA < scoreB ? 0 : 1 };
}

// Stroke-play team standings: compare team stroke totals over a range.
// scorer: function(strokes, teamPlayers, holeIdx) → number | null
export function legStandingsTeamStroke(strokes, teamA, teamB, holeRange, scorer) {
  let totalA = 0, totalB = 0, holesPlayed = 0;
  for (const h of holeRange) {
    const sA = scorer(strokes, teamA, h);
    const sB = scorer(strokes, teamB, h);
    if (sA === null || sB === null) continue;
    holesPlayed++;
    totalA += sA;
    totalB += sB;
  }
  return { totalA, totalB, holesPlayed };
}

// Human-readable stroke-play status for two teams.
export function legMatchStatusTeamStroke(strokes, teamA, teamB, holeRange, teamNames, scorer) {
  const { totalA, totalB, holesPlayed } = legStandingsTeamStroke(strokes, teamA, teamB, holeRange, scorer);
  if (holesPlayed === 0) return 'Not started';
  const diff = totalA - totalB;
  if (diff === 0) return 'All Square';
  const leader = diff < 0 ? teamNames[0] : teamNames[1];
  return `${leader} leads (${Math.abs(diff)} strokes)`;
}

// Settlement for stroke-play team formats.
function settleTeamRangeStroke(net, strokes, teamA, teamB, range, stake, scorer) {
  const { totalA, totalB } = legStandingsTeamStroke(strokes, teamA, teamB, range, scorer);
  if (totalA < totalB) {
    for (const pi of teamA) net[pi] += stake / 2;
    for (const pi of teamB) net[pi] -= stake / 2;
  } else if (totalB < totalA) {
    for (const pi of teamB) net[pi] += stake / 2;
    for (const pi of teamA) net[pi] -= stake / 2;
  }
}

// Computes net dollar amounts per player for 2v2 team Nassau, before collapsing
// into minimum-cash-flow payments. Every team member always ends up with the
// same net as their teammate (each settle call splits the stake evenly across
// the team), so callers needing a live "team net" (e.g. Leaderboard) can just
// read net[team[0]].
export function netNassauTeamFormat(players, teams, strokes, nassauStake, holeCount = 18, nassauPresses = {}, teamFormat = 'match-play') {
  const [teamA, teamB] = teams;
  const frontRange = Array.from({ length: 9 }, (_, i) => i);
  const backRange  = Array.from({ length: Math.min(9, holeCount - 9) }, (_, i) => i + 9);
  const totalRange = Array.from({ length: holeCount }, (_, i) => i);
  const legDefs = holeCount >= 18
    ? [['front', frontRange], ['back', backRange], ['total', totalRange]]
    : [['front', frontRange]];

  const net = new Array(players.length).fill(0);

  if (teamFormat === 'match-play' || teamFormat === 'scramble') {
    // Hole-by-hole match play — scramble uses the same win/loss counting as
    // match play (both compare each team's best-ball score per hole), just with
    // a single shared ball instead of each player's own.
    function settleTeamRange(range, stake) {
      const { winsA, winsB } = legStandingsTeam(strokes, teamA, teamB, range);
      const diff = winsA - winsB;
      if (diff > 0) { for (const pi of teamA) net[pi] += stake / 2; for (const pi of teamB) net[pi] -= stake / 2; }
      else if (diff < 0) { for (const pi of teamB) net[pi] += stake / 2; for (const pi of teamA) net[pi] -= stake / 2; }
    }
    for (const [legKey, range] of legDefs) {
      settleTeamRange(range, nassauStake);
      for (const press of (nassauPresses[legKey] || [])) {
        const pressRange = range.filter(h => h >= press.startHole);
        if (pressRange.length > 0) settleTeamRange(pressRange, nassauStake);
      }
    }
  } else {
    // Legacy stroke-play formats ('best-ball'/'combined') — no longer selectable from
    // Setup, kept only so an in-progress round started before this change still settles.
    const scorer = teamFormat === 'combined' ? teamCombined : teamBestBall;
    for (const [legKey, range] of legDefs) {
      settleTeamRangeStroke(net, strokes, teamA, teamB, range, nassauStake, scorer);
      for (const press of (nassauPresses[legKey] || [])) {
        const pressRange = range.filter(h => h >= press.startHole);
        if (pressRange.length > 0) settleTeamRangeStroke(net, strokes, teamA, teamB, pressRange, nassauStake, scorer);
      }
    }
  }

  return net;
}

// Main entry point for 2v2 settlement — routes by teamFormat.
export function computeNassauSettleUpTeamFormat(players, teams, strokes, nassauStake, holeCount = 18, nassauPresses = {}, teamFormat = 'match-play') {
  return minimumCashFlowNassau(players, netNassauTeamFormat(players, teams, strokes, nassauStake, holeCount, nassauPresses, teamFormat));
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

// Presses relevant to a specific pair within a leg. A press with no `players`
// field (2-player games) is treated as applying to whichever pair is asked about.
function relevantPairPresses(legPresses, a, b) {
  return legPresses.filter(p => !p.players || (p.players.includes(a) && p.players.includes(b)));
}

// Press eligibility for a specific pair in round-robin individual Nassau (3-5 players).
// Each pair runs its own independent 2-down/press check, same rule as canPressLeg.
export function canPressPair(strokes, a, b, legRange, legPresses, currentHole) {
  const remaining = legRange.filter(h => h >= currentHole).length;
  if (remaining <= 0) return false;
  const relevant = relevantPairPresses(legPresses, a, b);
  const lastPress = relevant[relevant.length - 1];
  const activeStart = lastPress ? lastPress.startHole : legRange[0];
  const completedRange = legRange.filter(h => h >= activeStart && h < currentHole);
  if (completedRange.length === 0) return false;
  const { wins } = legStandings(strokes, [a, b], completedRange);
  return Math.abs(wins[a] - wins[b]) >= 2;
}

// Status of the current active match between a specific pair (from their last press, or leg start).
export function activeStatusPair(strokes, a, b, legRange, legPresses, playerNames) {
  const relevant = relevantPairPresses(legPresses, a, b);
  const lastPress = relevant[relevant.length - 1];
  const activeStart = lastPress ? lastPress.startHole : legRange[0];
  const activeRange = legRange.filter(h => h >= activeStart);
  return legMatchStatus(strokes, [a, b], activeRange, playerNames);
}

// ─── Individual round-robin stroke-play ──────────────────────────────────────
// "Stroke-Play" individual Nassau: each pair's leg is settled by comparing
// total strokes over the leg — lower total wins the full stake, a tie means
// no money changes hands for that pair/leg. No hole-by-hole match play, and
// no press (a stroke total has no natural "2 down" trigger).

// Human-readable stroke-play status for a pair of individual players.
export function legMatchStatusPairStroke(strokes, a, b, holeRange, playerNames) {
  const { totalA, totalB, holesPlayed } = legStandingsTeamStroke(strokes, [a], [b], holeRange, teamCombined);
  if (holesPlayed === 0) return 'Not started';
  const diff = totalA - totalB;
  if (diff === 0) return holesPlayed === holeRange.length ? 'Halved' : 'All Square';
  const leader = (diff < 0 ? playerNames[a] : playerNames[b]).split(' ')[0];
  return `${leader} leads by ${Math.abs(diff)}`;
}

// Net dollar amounts per player for individual round-robin stroke play: for
// every pair and every leg, whichever player has fewer total strokes wins the
// full nassauStake from the other; a tie is a push (no money for that pair/leg).
export function netNassauStroke(players, strokes, nassauStake, holeCount = 18) {
  const n = players.length;
  const frontRange = Array.from({ length: 9 }, (_, i) => i);
  const backRange  = Array.from({ length: Math.min(9, holeCount - 9) }, (_, i) => i + 9);
  const totalRange = Array.from({ length: holeCount }, (_, i) => i);
  const legDefs = holeCount >= 18 ? [frontRange, backRange, totalRange] : [frontRange];

  const net = new Array(n).fill(0);

  for (const range of legDefs) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const { totalA, totalB } = legStandingsTeamStroke(strokes, [i], [j], range, teamCombined);
        if (totalA < totalB) { net[i] += nassauStake; net[j] -= nassauStake; }
        else if (totalB < totalA) { net[j] += nassauStake; net[i] -= nassauStake; }
      }
    }
  }

  return net;
}

export function computeNassauSettleUpStroke(players, strokes, nassauStake, holeCount = 18) {
  return minimumCashFlowNassau(players, netNassauStroke(players, strokes, nassauStake, holeCount));
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
    // Original leg — full round-robin among all players
    settleLegRange(net, strokes, playerIdxs, range, nassauStake);
    // Each press — settles only between the pair who declared it (2-player games
    // never set `players`, so this falls back to the same pair as the original leg)
    for (const press of (nassauPresses[legKey] || [])) {
      const pressRange = range.filter(h => h >= press.startHole);
      if (pressRange.length > 0) settleLegRange(net, strokes, press.players || playerIdxs, pressRange, nassauStake);
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
