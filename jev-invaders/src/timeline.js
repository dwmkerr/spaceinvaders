// One spike per decision: where it sits shows when the answer landed, and how
// tall it is shows the confidence that came with it. Both panels share the
// same window, so a fast model reads as a dense row and a slow one as a few.
export function timelineBars(events, elapsedMs, { windowMs, width, height }) {
  const windowEnd = Math.max(elapsedMs, windowMs);
  const windowStart = windowEnd - windowMs;
  const bars = [];

  for (const event of events) {
    if (event.atMs < windowStart || event.atMs > windowEnd) {
      continue;
    }
    const x = Math.min(width - 1, Math.floor(((event.atMs - windowStart) / windowMs) * width));
    if (event.error) {
      bars.push({ x, height, kind: 'error' });
    } else if (event.confidence === null) {
      // No confidence came back, so mark the decision without claiming one.
      bars.push({ x, height: Math.round(height * 0.1), kind: 'unknown' });
    } else {
      bars.push({ x, height: Math.max(1, Math.round(event.confidence * height)), kind: 'decision' });
    }
  }
  return bars;
}

export function averageConfidence(events) {
  const values = events
    .map((event) => event.confidence)
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function drawTimeline(ctx, view, palette, windowMs) {
  const { width, height } = ctx.canvas;
  const top = 14;
  const plotHeight = height - top - 2;

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = palette.faint;
  ctx.fillRect(0, height - 1, width, 1);
  ctx.fillRect(0, top, width, 1);

  const colours = { decision: palette.accent, unknown: palette.muted, error: palette.error };
  for (const bar of timelineBars(view.events, view.elapsedMs, { windowMs, width, height: plotHeight })) {
    ctx.fillStyle = colours[bar.kind];
    ctx.fillRect(bar.x, height - 1 - bar.height, 2, bar.height);
  }

  const average = averageConfidence(view.events);
  ctx.fillStyle = palette.muted;
  ctx.font = `11px ${palette.mono}`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(`confidence per decision, last ${Math.round(windowMs / 1000)} s`, 0, 10);
  ctx.textAlign = 'right';
  ctx.fillText(average === null ? 'avg -' : `avg ${average.toFixed(2)}`, width, 10);
}
