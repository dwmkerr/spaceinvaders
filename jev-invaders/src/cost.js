function requireUsage(usage) {
  if (
    !usage
    || typeof usage.input_tokens !== 'number'
    || typeof usage.output_tokens !== 'number'
  ) {
    throw new Error('usage missing');
  }
}

export function jevCostUSD(usage, price) {
  requireUsage(usage);
  return (
    usage.input_tokens * price.inputPerMTok
    + usage.output_tokens * price.outputPerMTok
  ) / 1e6;
}

export function anthropicCostUSD(usage, price) {
  requireUsage(usage);
  const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  return (
    usage.input_tokens * price.inputPerMTok
    + usage.output_tokens * price.outputPerMTok
    + cacheCreationTokens * price.cacheWritePerMTok
    + cacheReadTokens * price.cacheReadPerMTok
  ) / 1e6;
}

export function byteLength(str) {
  return new TextEncoder().encode(str).length;
}

export function worstCaseCostUSD({
  price,
  inputBytes,
  overheadTokens,
  maxOutputTokens,
}) {
  return (
    (inputBytes + overheadTokens) * price.inputPerMTok
    + maxOutputTokens * price.outputPerMTok
  ) / 1e6;
}

export function formatUSD(value) {
  return `$${value.toFixed(5)}`;
}

export function formatThinking(thinkingMs, rollingAverage) {
  const total = `${(thinkingMs / 1000).toFixed(1)} s`;
  if (rollingAverage === null) {
    return total;
  }
  const average = rollingAverage < 1000
    ? `${Math.round(rollingAverage)} ms`
    : `${(rollingAverage / 1000).toFixed(1)} s`;
  return `${total} (${average})`;
}
