// Which controls make sense for the two panels' current statuses. Kept free of
// the DOM so the rules can be tested.
export function controlState(statuses) {
  const allIdle = statuses.every((status) => status === 'idle');
  const anyRunning = statuses.includes('running');
  const anyStopped = statuses.includes('stopped');

  return {
    canStart: allIdle || (anyStopped && !anyRunning),
    canStop: anyRunning,
    canReset: !allIdle,
    // Switching mode rebuilds the run, so it must not happen under a live one.
    canSwitchMode: !anyRunning,
  };
}
