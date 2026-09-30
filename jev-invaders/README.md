# jev-invaders

This is the demo for the "Decision Models - Understanding Jev" post. It puts Jev and Opus 5.5 side by side in two small Space Invaders games.

## Prerequisites

Install Node 24.

## Setup

Copy the example environment file:

```sh
cp .env.example .env
```

## Run the demo

Start the local server:

```sh
npm start
```

Then open `http://127.0.0.1:8787/?mock=1`.

## URL parameters

| Parameter | Meaning |
|---|---|
| `mock=1` or `mock=true` | Use local mock drivers. |
| `mode=strategic` | Use System 2. Any other value uses System 1. |
| `seed=<number>` | Set the game seed. The default is `1983`. |
| `autostart=1` | Start the run when the page loads. |
| `jevLatency=<ms>` | Set Jev's mock latency. |
| `frontierLatency=<ms>` | Set Opus's mock latency. |

Parameters can be combined, for example `?mock=1&mode=strategic&autostart=1`.

## Modes

System 1 - Reflexive is a real-time game. The cannon moves and fires while invaders march, rockets rise, and bombs fall. A slow answer leaves the cannon still while the game continues.

System 2 - Strategic is a 30-turn siege with four lanes. Drones move one cell, runners move two, and the cannon can fire, turn, or spend one of three smart bombs. Surviving lives and unused bombs add to the final score.

## Caps and costs

`maxSpendUSD` applies to both panels together and is configured per mode. Reflexive mode has a $0.50 cap. Strategic mode is uncapped by default, although its turn and time limits still apply.

The proxy also has a process-wide `maxProcessSpendUSD` backstop. Restarting the server resets that backstop. Pricing comes from the `claude-api` skill's model table, cached on 25 September 2026. It is marked OWNER TO CONFIRM against the live pricing page.

## Credentials

For a live run, set `TYPESAFE_API_KEY` for Jev. For Opus, set either `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`. A bearer token can use an optional gateway URL in `ANTHROPIC_BASE_URL`.

Mock mode does not need credentials and makes no API calls.

## Fairness

Both panels use the same game seed, rules, and deterministic event schedule. Both drivers use the same state encoder and decision questions for a mode. Every answer is used, and an error stops that panel instead of switching to a fallback model.

## Known limitations

Opus 5.5 always thinks. Reflexive mode can only minimise this with `effort: 'low'` and a direct system instruction; it cannot turn thinking off.

## Run the tests

```sh
npm test
```

## Summary

Use mock mode to explore both games without API calls. Add credentials only when you are ready to compare the live models and their costs.
