const WIDTH = 480;
const HEIGHT = 480;
const CELL_WIDTH = WIDTH / 16;
const CELL_HEIGHT = HEIGHT / 20;
const STRATEGIC_CELL_SIZE = 36;
const STRATEGIC_OFFSET = 6;
const STRATEGIC_CENTRE = 6;
const STRATEGIC_LANE_LENGTH = 6;

const laneOffsets = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

function cellPosition(item) {
  return {
    x: item.col * CELL_WIDTH,
    y: item.row * CELL_HEIGHT,
  };
}

function strategicCell(lane, distance) {
  const offset = laneOffsets[lane];
  return {
    x: STRATEGIC_OFFSET
      + (STRATEGIC_CENTRE + offset.x * distance) * STRATEGIC_CELL_SIZE,
    y: STRATEGIC_OFFSET
      + (STRATEGIC_CENTRE + offset.y * distance) * STRATEGIC_CELL_SIZE,
  };
}

function drawOverlay(ctx, palette, overlay) {
  if (!overlay) {
    return;
  }

  ctx.font = `16px ${palette.mono}`;
  const textWidth = typeof ctx.measureText === 'function'
    ? ctx.measureText(overlay).width
    : overlay.length * 10;
  const boxWidth = textWidth + 24;
  const boxHeight = 36;
  ctx.fillStyle = palette.bg;
  ctx.fillRect((WIDTH - boxWidth) / 2, (HEIGHT - boxHeight) / 2, boxWidth, boxHeight);
  ctx.fillStyle = palette.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(overlay, WIDTH / 2, HEIGHT / 2);
}

export function drawReflexive(ctx, snapshot, palette, overlay = '') {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = palette.faint;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1);

  ctx.fillStyle = palette.faint;
  ctx.fillRect(0, HEIGHT - 2, WIDTH, 2);

  for (const invader of snapshot.invaders) {
    const { x, y } = cellPosition(invader);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(x + 5, y + 5, 20, 14);
    ctx.fillStyle = palette.bg;
    ctx.fillRect(x + 9, y + 9, 4, 4);
    ctx.fillRect(x + 17, y + 9, 4, 4);
  }

  const cannon = cellPosition(snapshot.cannon);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(cannon.x + 4, cannon.y + 12, 22, 10);
  ctx.fillRect(cannon.x + 12, cannon.y + 6, 6, 6);

  if (snapshot.rocket) {
    const rocket = cellPosition(snapshot.rocket);
    ctx.fillStyle = palette.accent;
    ctx.fillRect(rocket.x + 14, rocket.y + 4, 2, 16);
  }

  for (const bomb of snapshot.bombs) {
    const { x, y } = cellPosition(bomb);
    ctx.fillStyle = palette.muted;
    ctx.fillRect(x + 13, y + 6, 4, 12);
  }

  ctx.fillStyle = palette.muted;
  ctx.font = `12px ${palette.mono}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(`lives ${snapshot.lives}  wave ${snapshot.wave}`, 8, 16);

  drawOverlay(ctx, palette, overlay);
}

function drawRunner(ctx, threat, x, y) {
  const points = {
    north: [[8, 8], [28, 8], [18, 28]],
    east: [[28, 8], [28, 28], [8, 18]],
    south: [[8, 28], [28, 28], [18, 8]],
    west: [[8, 8], [8, 28], [28, 18]],
  }[threat.lane];
  ctx.beginPath();
  ctx.moveTo(x + points[0][0], y + points[0][1]);
  ctx.lineTo(x + points[1][0], y + points[1][1]);
  ctx.lineTo(x + points[2][0], y + points[2][1]);
  ctx.closePath();
  ctx.fill();
}

export function drawStrategic(ctx, snapshot, palette, overlay = '') {
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = palette.faint;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1);

  for (const lane of Object.keys(laneOffsets)) {
    for (let distance = 1; distance <= STRATEGIC_LANE_LENGTH; distance += 1) {
      const { x, y } = strategicCell(lane, distance);
      ctx.strokeRect(x + 0.5, y + 0.5, STRATEGIC_CELL_SIZE - 1, STRATEGIC_CELL_SIZE - 1);
    }
  }

  if (snapshot.lastShot) {
    const centre = strategicCell('north', 0);
    const hit = strategicCell(
      snapshot.lastShot.lane,
      snapshot.lastShot.distance ?? STRATEGIC_LANE_LENGTH,
    );
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centre.x + 18, centre.y + 18);
    ctx.lineTo(hit.x + 18, hit.y + 18);
    ctx.stroke();
  }

  ctx.fillStyle = palette.ink;
  for (const threat of snapshot.threats) {
    const { x, y } = strategicCell(threat.lane, threat.distance);
    if (threat.kind === 'drone') {
      ctx.fillRect(x + 9, y + 9, 18, 18);
    } else {
      drawRunner(ctx, threat, x, y);
    }
  }

  const centre = strategicCell('north', 0);
  ctx.fillStyle = palette.accent;
  ctx.fillRect(centre.x + 8, centre.y + 8, 20, 20);
  const turrets = {
    north: [centre.x + 15, centre.y, 6, 10],
    south: [centre.x + 15, centre.y + 26, 6, 10],
    east: [centre.x + 26, centre.y + 15, 10, 6],
    west: [centre.x, centre.y + 15, 10, 6],
  };
  ctx.fillRect(...turrets[snapshot.facing]);

  ctx.fillStyle = palette.muted;
  ctx.font = `12px ${palette.mono}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(
    `turn ${snapshot.turn}/${snapshot.turns}  lives ${snapshot.lives}  bombs ${snapshot.smartBombs}`,
    8,
    16,
  );

  drawOverlay(ctx, palette, overlay);
}

export function drawPanel(ctx, snapshot, palette, overlay = '') {
  if (snapshot.mode === 'reflexive') {
    drawReflexive(ctx, snapshot, palette, overlay);
    return;
  }
  if (snapshot.mode === 'strategic') {
    drawStrategic(ctx, snapshot, palette, overlay);
    return;
  }
  throw new Error(`renderer not built for mode: ${snapshot.mode}`);
}
