import { formatThinking, formatUSD } from './cost.js';

export function hudStrings(view) {
  return {
    score: view.snapshot.score.toLocaleString('en-GB'),
    decisions: String(view.stats.decisions),
    thinking: formatThinking(
      view.stats.thinkingMs + view.inFlightMs,
      view.rollingAvgMs,
    ),
    cost: formatUSD(view.stats.costUSD),
    status: view.statusText,
  };
}

export function renderHud(elements, strings) {
  elements.score.textContent = strings.score;
  elements.decisions.textContent = strings.decisions;
  elements.thinking.textContent = strings.thinking;
  elements.cost.textContent = strings.cost;
  elements.status.textContent = strings.status;
}
