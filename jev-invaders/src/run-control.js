export function createRunControl({ build, start }) {
  let started = false;

  return {
    click() {
      if (started) {
        build();
        started = false;
        return;
      }

      start();
      started = true;
    },
    isStarted() {
      return started;
    },
  };
}
