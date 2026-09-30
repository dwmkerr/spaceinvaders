import { getContract } from '../contract.js';
import { rand } from '../rng.js';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const defaultNow = () => performance.now();

export function createMockDriver({
  label,
  mode,
  latencyMs,
  costPerCallUSD,
  seed,
  confidence = [0.5, 1],
  sleep = defaultSleep,
  now = defaultNow,
}) {
  const contract = getContract(mode);
  let call = 0;

  return {
    label: `${label} [mock]`,
    isMock: true,

    worstCaseCostUSD() {
      return costPerCallUSD;
    },

    async decide(state, override) {
      const startedAt = now();
      const callNumber = call;
      call += 1;

      try {
        await sleep(latencyMs);
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
          costUSD: 0,
          latencyMs: now() - startedAt,
          tokens: { input: 0, output: 0 },
        };
      }

      const result = {};
      for (const [name, question] of Object.entries((override ?? contract).questions)) {
        const draw = rand(seed, callNumber, name);
        if (question.type === 'choice') {
          const options = Object.keys(question.criteria);
          result[name] = options[Math.floor(draw * options.length)];
        } else if (question.type === 'noul') {
          result[name] = draw < (name === 'bomb' ? 0.05 : 0.5);
        }
      }

      const [low, high] = confidence;
      return {
        ...result,
        confidence: low + rand(seed, callNumber, 'confidence') * (high - low),
        costUSD: costPerCallUSD,
        latencyMs: now() - startedAt,
        tokens: { input: 0, output: 0 },
      };
    },
  };
}
