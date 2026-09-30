const WIDTH = 480;
const HEIGHT = 480;
const CELL_WIDTH = WIDTH / 16;
const CELL_HEIGHT = HEIGHT / 20;

function cellPosition(item) {
  return {
    x: item.col * CELL_WIDTH,
    y: item.row * CELL_HEIGHT,
  };
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

  if (overlay) {
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
}

export function drawPanel(ctx, snapshot, palette, overlay = '') {
  if (snapshot.mode === 'reflexive') {
    drawReflexive(ctx, snapshot, palette, overlay);
    return;
  }
  throw new Error(`renderer not built for mode: ${snapshot.mode}`);
}
