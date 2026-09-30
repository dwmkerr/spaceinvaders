// Turns decisions into short lines for the feed beside each game, so a viewer
// can read what a model just chose without decoding it from the sprites.

export function describeAction(action) {
  const parts = [];
  if (action.move && action.move !== 'stay') {
    parts.push(`move ${action.move}`);
  }
  if (action.fire) {
    parts.push('fire');
  }
  return parts.length > 0 ? parts.join(', ') : 'hold';
}

// The newest `count` decisions, oldest first, each with how far back it is
// (0 is the newest) so the page can fade the older ones.
export function feedLines(events, count) {
  const recent = events.slice(-count);
  return recent.map((event, index) => ({
    text: event.label ?? '',
    confidence: Number.isFinite(event.confidence) ? event.confidence.toFixed(2) : '',
    back: recent.length - 1 - index,
    error: Boolean(event.error),
  }));
}
