# Jev Invaders

**Important: this was quickly vibe-coded as a demo and experiment.** It is not a model of how to build software, and it has not been reviewed with that in mind.

This is the demo for the post [Decision Models - Understanding Jev](https://dwmkerr.com/decision-models-understanding-jev/). Two cannons play the same Space Invaders game side by side. Jev, a decision model, drives the left one and Claude Sonnet 5.5 drives the right one. Under each game you can see what the model has cost and how long it has spent thinking.

The look is a nod to the original [Space Invaders](https://dwmkerr.github.io/spaceinvaders/) in this repository.

## Prerequisites

Install Node 24.

## Setup

Copy the example environment file and add your keys:

```sh
cp .env.example .env
```

## Run the demo

Start the local server:

```sh
npm start
```

Then open `http://127.0.0.1:8787/?mock=1` to try it without any API calls, or `http://127.0.0.1:8787/` for a live run.

The tabs at the top choose the mode. The buttons under the games control the run:

- **Start** begins a run, or resumes one you stopped. Clicking a game that shows "start" does the same.
- **Stop** freezes both games and stops new API calls. An answer already on its way still lands and is counted in the cost.
- **Reset** throws the run away and returns both panels to the ready state.
- **Speed** sets how fast the real-time game runs, from half speed to four times. It starts at 1.5x and does nothing in the match.

## URL parameters

| Parameter | Meaning |
|---|---|
| `mock=1` or `mock=true` | Use local mock drivers. |
| `mode=strategic` | Open the Connect Four match. Any other value opens the real-time game. |
| `seed=<number>` | Set the game seed. The default is `1983`. |
| `autostart=1` | Start the run when the page loads. |
| `speed=<number>` | Set the real-time game's speed, from `0.5` to `4`. The default is `1.5`. |
| `jevLatency=<ms>` | Set Jev's mock latency. |
| `frontierLatency=<ms>` | Set Sonnet's mock latency. |

Parameters can be combined, for example `?mock=1&mode=strategic&autostart=1`.

## Modes

System 1 - Reflexive is a real-time game. The cannon moves and fires while invaders march, rockets rise, and bombs fall. A slow answer leaves the cannon still while the game continues. There is one ship and no spare lives, so the first bomb to land ends the game.

System 2 - Strategic is a head-to-head: Jev and Sonnet play Connect Four against each other on one board, shown in both panels. Jev's pieces are the green invader blocks and Sonnet's are the grey ship blocks. A run is a match of four games, and the models take turns to go first. The code drops the first piece of each game in a seeded random column, because both models answer the same position the same way every time and the games would otherwise repeat. Picking a full column loses that game.

The ship, or in the match each model's piece above the board, shows the model at work. An arc sweeps round it while an answer is pending and starts again with each answer, and every answer sends out a ring. A fast model's arc only twitches. A slow model's arc goes round and round.

Under each game a short feed lists the latest decisions in words, such as "move left, fire" or "column d", with the confidence beside each. The HUD shows decisions per second and how long one decision takes. In the match its score row counts games won.

In the real-time game the ship's own fire is blue and enemy bombs are red, and both leave a trail.

## How the questions are written

Each mode asks a few questions per decision, and every option says when it is the right answer. That wording matters more than anything else here. The first version asked "Move the cannon to survive and line up a shot" with options that only said "one column left", and live Jev walked into bombs with a confidence near zero.

TypeSafe's own Doom demo shows the same approach on screen: separate judgments for firing, goal, dodging and movement, each a choice between named options, over a large structured state with a legend explaining its distance bands.

## The timeline

The strip under each game draws one spike per decision. Where a spike sits shows when the answer landed, and its height shows the confidence that came with it. Both strips cover the last 30 seconds, so a fast model shows as a dense row and a slow one as a few spikes.

The two confidence figures are not the same kind of number:

- Jev returns a calibrated confidence with every choice. The strip shows the one for the `move` question.
- Sonnet has no such figure, so the prompt asks it to state a probability from 0 to 1 for its move. That is a self-report.

## Caps and costs

`maxSpendUSD` applies to both models together and is configured per mode. The real-time game has a $0.50 cap. The match is uncapped by default, although it ends after four games and the time limit still applies.

The proxy also has a process-wide `maxProcessSpendUSD` backstop. Restarting the server resets that backstop. Pricing comes from the `claude-api` skill's model table, cached on 25 September 2026. It is marked OWNER TO CONFIRM against the live pricing page.

## Credentials

For a live run, set `TYPESAFE_API_KEY` for Jev.

For Sonnet there are three options, tried in this order:

1. `ANTHROPIC_API_KEY`, sent to the Messages API.
2. `ANTHROPIC_AUTH_TOKEN`, a bearer token, with an optional gateway URL in `ANTHROPIC_BASE_URL`.
3. `ANTHROPIC_USE_CLAUDE_CLI=1`, which runs each decision through the `claude` CLI and its login.

The CLI route has two things you should know about:

- Starting a CLI process takes a couple of seconds, so the proxy keeps one started ahead of time for each mode. A decision then takes roughly 2.5 seconds, of which about 1.5 seconds is API time. The page says "Sonnet 5.5 via the Claude Code CLI" so a recording does not pass the extra off as the model's own latency.
- The cost shown is what the CLI reports the call would cost on the API. A subscription login is not billed per call.

Mock mode does not need credentials and makes no API calls.

The server trusts the operating system's certificate store as well as Node's own. Without that, a corporate TLS proxy makes every upstream call fail with `SELF_SIGNED_CERT_IN_CHAIN`.

## Fairness

In the real-time game both panels use the same seed, rules and event schedule. In the match both models see the board from their own side, described the same way, and answer the same question. Every answer is used, and an error stops the run instead of switching to a fallback model.

One thing differs: Sonnet is asked the extra confidence question described above, which adds a few output tokens to each of its calls.

## Known limitations

- Through the Messages API, reflexive mode turns Sonnet's thinking off with `thinking: {type: "between_tools"}` and low effort. Through the CLI, only the effort level can be set.

## Run the tests

```sh
npm test
```

## Summary

Use mock mode to explore both games without API calls. Add credentials only when you are ready to compare the live models and their costs.
