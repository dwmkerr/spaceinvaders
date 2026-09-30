// The small grid the game logic, encoder and panel tests were written against.
// Those tests check the rules, which do not depend on the grid's size, so they
// keep this grid while the shipped config uses the original game's larger one.
export const classicReflexive = Object.freeze({
  tickIntervalMs: 50,
  cols: 16,
  rows: 20,
  cannonRow: 19,
  rocketStartRow: 18,
  cannonStartCol: 7,
  lives: 3,
  formation: { cols: 6, rows: 3, spacing: 2, startCol: 2, startRow: 1 },
  points: [30, 20, 10],
  invaderMoveEvery: 16,
  bombFallEvery: 4,
  bombChance: 0.04,
  maxBombs: 4,
  invasionRow: 18,
});
