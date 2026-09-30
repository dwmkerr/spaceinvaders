export function createStats() {
  return {
    decisions: 0,
    thinkingMs: 0,
    costUSD: 0,
    recentLatencies: [],
  };
}

export function recordDecision(stats, { latencyMs, costUSD }) {
  return {
    ...stats,
    decisions: stats.decisions + 1,
    thinkingMs: stats.thinkingMs + latencyMs,
    costUSD: stats.costUSD + costUSD,
    recentLatencies: [...stats.recentLatencies, latencyMs],
  };
}

export function recordBilledError(stats, { latencyMs, costUSD }) {
  return {
    ...stats,
    thinkingMs: stats.thinkingMs + latencyMs,
    costUSD: stats.costUSD + costUSD,
  };
}

export function rollingAverageMs(stats, window) {
  const latencies = stats.recentLatencies.slice(-window);
  if (latencies.length === 0) {
    return null;
  }
  const total = latencies.reduce((sum, latency) => sum + latency, 0);
  return total / latencies.length;
}
