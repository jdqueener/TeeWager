// Shared 2v2 team naming — used by both Nassau teams and Beans-scramble teams.
// Short label ("Team A"/"Team B") is what's shown everywhere tight on space
// (status bars, press buttons, table columns, payment cards, leaderboard
// rows); the player-name string ("BV & JQ") is only shown once, as context,
// near the top of a screen — not repeated in every small space, since full
// names can easily overflow a narrow chip or button.

export function teamShortName(idx) {
  return `Team ${String.fromCharCode(65 + idx)}`; // 0 -> "Team A", 1 -> "Team B"
}

export function teamPlayerNames(players, team) {
  return team.map(pi => players[pi]?.split(' ')[0]).join(' & ');
}
