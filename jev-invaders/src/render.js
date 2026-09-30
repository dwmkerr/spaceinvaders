import { rand } from './rng.js';

const WIDTH = 480;
const HEIGHT = 480;
const STAR_COUNT = 48;

// The colours of the original dwmkerr/spaceinvaders game, which this demo is a
// nod to. The player's own fire is blue so it can never be mistaken for a bomb.
export const gamePalette = {
  bg: '#000000',
  star: '#ffffff',
  invader: '#2a6b1e',
  ship: '#999999',
  shot: '#4da3ff',
  bomb: '#ff5555',
  lane: '#333333',
  text: '#ffffff',
  font: 'Arial, Helvetica, sans-serif',
};

// Star positions come from the seeded PRNG so both panels show the same sky.
const stars = Array.from({ length: STAR_COUNT }, (_, index) => {
  const size = 1 + Math.floor(rand('star', index, 'size') * 3);
  return {
    x: Math.floor(rand('star', index, 'x') * WIDTH),
    y: rand('star', index, 'y') * HEIGHT,
    size,
    // Bigger stars fall faster, which is what gave the original its depth.
    speed: 6 + size * 8,
  };
});

function cellGrid(snapshot) {
  const width = WIDTH / snapshot.cols;
  const height = HEIGHT / snapshot.rows;
  return {
    width,
    height,
    position: (item) => ({ x: item.col * width, y: item.row * height }),
  };
}

function drawBackground(ctx, timeMs) {
  ctx.globalAlpha = 1;
  ctx.fillStyle = gamePalette.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = gamePalette.star;
  for (const star of stars) {
    const y = (star.y + (star.speed * timeMs) / 1000) % HEIGHT;
    ctx.fillRect(star.x, Math.floor(y), star.size, star.size);
  }
}

function drawCornerText(ctx, left, right) {
  ctx.fillStyle = gamePalette.text;
  ctx.font = `14px ${gamePalette.font}`;
  ctx.textBaseline = 'alphabetic';
  if (left) {
    ctx.textAlign = 'left';
    ctx.fillText(left, 10, 17);
  }
  ctx.textAlign = 'right';
  ctx.fillText(right, WIDTH - 10, 17);
}

function drawOverlay(ctx, overlay, centreX, centreY) {
  if (!overlay) {
    return;
  }

  ctx.font = `16px ${gamePalette.font}`;
  const textWidth = typeof ctx.measureText === 'function'
    ? ctx.measureText(overlay).width
    : overlay.length * 10;
  const boxWidth = Math.min(WIDTH - 16, textWidth + 24);
  const boxHeight = 36;
  const left = Math.max(8, centreX - boxWidth / 2);
  ctx.fillStyle = gamePalette.bg;
  ctx.fillRect(left, centreY - boxHeight / 2, boxWidth, boxHeight);
  ctx.strokeStyle = gamePalette.text;
  ctx.lineWidth = 1;
  ctx.strokeRect(left + 0.5, centreY - boxHeight / 2 + 0.5, boxWidth - 1, boxHeight - 1);
  ctx.fillStyle = gamePalette.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(overlay, left + boxWidth / 2, centreY, boxWidth - 16);
}

// A fading row of dots from `from` to `to` (pixel centres), brightest at `to`.
// It shows where a bomb or a shot came from, which a lone square cannot.
function drawTrail(ctx, colour, from, to, steps) {
  if (steps < 1) {
    return;
  }
  ctx.fillStyle = colour;
  for (let index = 0; index < steps; index += 1) {
    const along = index / steps;
    ctx.globalAlpha = 0.08 + 0.5 * along;
    ctx.fillRect(
      from.x + (to.x - from.x) * along - 1,
      from.y + (to.y - from.y) * along - 1,
      2,
      2,
    );
  }
  ctx.globalAlpha = 1;
}

// Shows the model at work on the ship itself: a short arc that circles for as
// long as an answer is pending, and a ring each time one lands, so the rate of
// decisions is visible. The arc keeps a fixed length because one that grows
// reads as a progress bar filling up, which a wait of unknown length is not.
function drawActivity(ctx, centre, radius, activity, timeMs) {
  if (!activity) {
    return;
  }
  const { thinkingMs = 0, sinceDecisionMs = null } = activity;
  ctx.strokeStyle = gamePalette.text;

  if (sinceDecisionMs !== null && sinceDecisionMs < 300) {
    const age = sinceDecisionMs / 300;
    ctx.globalAlpha = 1 - age;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius + 2 + 10 * age, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (thinkingMs > 0) {
    const start = ((timeMs / 1000) % 1) * Math.PI * 2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centre.x, centre.y, radius, start, start + Math.PI * 0.6);
    ctx.stroke();
  }
}

export function drawReflexive(ctx, snapshot, overlay = '', timeMs = 0, activity = null) {
  drawBackground(ctx, timeMs);
  const cell = cellGrid(snapshot);
  const centreOf = (item) => {
    const { x, y } = cell.position(item);
    return { x: x + cell.width / 2, y: y + cell.height / 2 };
  };

  // Blocks nearly fill their cells, which gives the tight grid of the original.
  ctx.fillStyle = gamePalette.invader;
  for (const invader of snapshot.invaders) {
    const { x, y } = cell.position(invader);
    ctx.fillRect(x + 1, y + 2, cell.width - 2, cell.height - 4);
  }

  const cannon = cell.position(snapshot.cannon);
  ctx.fillStyle = gamePalette.ship;
  ctx.fillRect(cannon.x + 2, cannon.y + 4, cell.width - 4, cell.height - 6);

  if (snapshot.rocket) {
    const rocket = cell.position(snapshot.rocket);
    const head = centreOf(snapshot.rocket);
    const tailRows = Math.min(5, snapshot.cannon.row - 1 - snapshot.rocket.row);
    drawTrail(
      ctx,
      gamePalette.shot,
      { x: head.x, y: head.y + tailRows * cell.height },
      head,
      tailRows * 3,
    );
    ctx.fillStyle = gamePalette.shot;
    ctx.fillRect(rocket.x + cell.width / 2 - 1, rocket.y + 4, 3, cell.height - 8);
  }

  for (const bomb of snapshot.bombs) {
    const head = centreOf(bomb);
    drawTrail(ctx, gamePalette.bomb, { x: head.x, y: head.y - 3 * cell.height }, head, 9);
    ctx.fillStyle = gamePalette.bomb;
    ctx.fillRect(head.x - 2, head.y - 2, 4, 4);
  }

  // The ship sits on the bottom row, so lift the spinner enough to keep the
  // whole ring on the canvas.
  const radius = cell.width * 0.75;
  const ship = centreOf(snapshot.cannon);
  drawActivity(ctx, { x: ship.x, y: Math.min(ship.y, HEIGHT - radius - 3) }, radius, activity, timeMs);

  // The original puts this text under the ship. Here the ship sits on the
  // bottom row, so the text goes in the empty top row instead.
  drawCornerText(ctx, '', `Score: ${snapshot.score}, Level: ${snapshot.wave}`);
  drawOverlay(ctx, overlay, WIDTH / 2, HEIGHT / 2);
}

// The match board, drawn to look like the real thing: a blue frame with round
// holes and a yellow and a red set of discs.
const BOARD_CELL = 60;
const BOARD_LEFT = (WIDTH - 7 * BOARD_CELL) / 2;
const BOARD_TOP = 92;
const DISC_RADIUS = 23;
export const boardPalette = {
  frame: '#1f4fbf',
  hole: '#0b1a40',
  jev: '#ffd21f',
  frontier: '#e5343a',
  win: '#ffffff',
};

export function drawStrategic(ctx, snapshot, overlay = '', timeMs = 0) {
  drawBackground(ctx, timeMs);
  const centreOf = (cell) => ({
    x: BOARD_LEFT + (cell.col + 0.5) * BOARD_CELL,
    y: BOARD_TOP + (cell.row + 0.5) * BOARD_CELL,
  });
  const disc = (cell, radius) => {
    const { x, y } = centreOf(cell);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
  };

  // Column letters, which are what the move lists name.
  ctx.fillStyle = gamePalette.text;
  ctx.font = `13px ${gamePalette.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (let col = 0; col < snapshot.cols; col += 1) {
    ctx.fillText('abcdefg'[col], BOARD_LEFT + (col + 0.5) * BOARD_CELL, BOARD_TOP - 18);
  }

  ctx.fillStyle = boardPalette.frame;
  ctx.fillRect(
    BOARD_LEFT - 10,
    BOARD_TOP - 10,
    snapshot.cols * BOARD_CELL + 20,
    snapshot.rows * BOARD_CELL + 20,
  );

  for (let row = 0; row < snapshot.rows; row += 1) {
    for (let col = 0; col < snapshot.cols; col += 1) {
      const owner = snapshot.board[row][col];
      ctx.fillStyle = owner ? boardPalette[owner] : boardPalette.hole;
      disc({ col, row }, DISC_RADIUS);
      ctx.fill();
    }
  }

  // A ring on the disc just played, so the eye can follow the game.
  if (snapshot.lastMove && !snapshot.line) {
    ctx.strokeStyle = boardPalette.win;
    ctx.lineWidth = 2;
    disc(snapshot.lastMove, DISC_RADIUS - 5);
    ctx.stroke();
  }

  // The four that won get a bright ring each and a line through them.
  if (snapshot.line) {
    ctx.strokeStyle = boardPalette.win;
    ctx.lineWidth = 4;
    for (const cell of snapshot.line) {
      disc(cell, DISC_RADIUS);
      ctx.stroke();
    }
    const from = centreOf(snapshot.line[0]);
    const to = centreOf(snapshot.line[3]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  }

  drawCornerText(
    ctx,
    `Game ${Math.min(snapshot.game + 1, snapshot.games)} of ${snapshot.games}`,
    `${snapshot.names.jev} ${snapshot.wins.jev} - ${snapshot.wins.frontier} ${snapshot.names.frontier}`,
  );
  drawOverlay(ctx, overlay, WIDTH / 2, 44);
}

export function drawPanel(ctx, snapshot, overlay = '', timeMs = 0, activity = null) {
  if (snapshot.mode === 'reflexive') {
    drawReflexive(ctx, snapshot, overlay, timeMs, activity);
  } else if (snapshot.mode === 'strategic') {
    drawStrategic(ctx, snapshot, overlay, timeMs);
  } else {
    throw new Error(`renderer not built for mode: ${snapshot.mode}`);
  }
}
