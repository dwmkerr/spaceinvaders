export function createLedger(limitUSD) {
  let spentUSD = 0;
  let nextReservationId = 1;
  const reservations = new Map();

  const reservedUSD = () => {
    let total = 0;
    for (const amount of reservations.values()) {
      total += amount;
    }
    return total;
  };

  return {
    get spentUSD() {
      return spentUSD;
    },

    get reservedUSD() {
      return reservedUSD();
    },

    canAfford(usd) {
      return limitUSD === null
        || spentUSD + reservedUSD() + usd <= limitUSD + 1e-12;
    },

    reserve(usd) {
      const id = nextReservationId;
      nextReservationId += 1;
      reservations.set(id, usd);
      return id;
    },

    settle(id, actualUSD) {
      if (!reservations.has(id)) {
        throw new Error(`unknown reservation: ${id}`);
      }
      reservations.delete(id);
      spentUSD += actualUSD;
    },

    release(id) {
      reservations.delete(id);
    },
  };
}

export function capBreach({ ticks, maxTicks, elapsedMs, maxWallClockSec }) {
  if (ticks >= maxTicks) {
    return 'ticks';
  }
  if (elapsedMs >= maxWallClockSec * 1000) {
    return 'time';
  }
  return null;
}
