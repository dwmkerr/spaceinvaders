import { formatUSD } from './cost.js';

function formatDuration(ms) {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function hudStrings(view) {
  return {
    score: view.snapshot.score.toLocaleString('en-GB'),
    // The rate is what separates the models at a glance, so show it beside the count.
    decisions: view.elapsedMs >= 1000
      ? `${view.stats.decisions} (${(view.stats.decisions / (view.elapsedMs / 1000)).toFixed(1)}/s)`
      : String(view.stats.decisions),
    // In the real-time game both models are always waiting on an answer, so a
    // running total is just the wall clock for both. What separates them is
    // how long one decision takes.
    thinking: view.rollingAvgMs === null || view.rollingAvgMs === undefined
      ? '-'
      : `${formatDuration(view.rollingAvgMs)} per decision`,
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
