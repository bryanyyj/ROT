# ROT — "Rest or Train" AI endurance coach

An **original** AI endurance coach: it reads your real training data (Strava, with Garmin deferred),
works out whether to **train hard / go easy / rest** with a transparent readiness engine, and a chat
coach (via OpenRouter) **plans and adapts your week** — grounded in that engine so advice isn't
hallucinated.

> **Clean-room / legal note.** This is an independent implementation built from *publicly documented
> sports-science methods* (e.g. CTL/ATL/TSB, acute:chronic workload ratio, HRV-guided training,
> Banister TRIMP). It is **not** a copy or reverse-engineering of any third-party app — no third-party
> code, assets, or branding are used. See [`docs/00-scope.md`](docs/00-scope.md).

## Status

**AI coach built.** Decision engine (`@rot/engine`, 22 tests) + Express backend (`apps/server`) that
grounds an LLM via **OpenRouter** + React UI (`apps/web`) with a **Coach** tab (chat + weekly plan) and
a **Daily check-in** tab. Runs on sample data out of the box; add keys for live LLM + Strava.

## Project layout

```
packages/engine   # pure, testable decision engine (no UI, no I/O)
apps/server       # Express API: Strava OAuth, engine grounding, OpenRouter chat/plan
apps/web          # React UI: Coach (chat + plan) + Daily check-in
docs/             # scope, research, behaviour spec, architecture, roadmap, validation
references/       # public-source notes & citations
```

## Run it

Requires Node.js ≥ 22.19.

```bash
npm install
cp .env.example apps/server/.env     # then add OPENROUTER_API_KEY (and optional Strava)
npm run dev --workspace apps/server  # API on http://localhost:8787
npm run dev --workspace apps/web     # UI  on http://localhost:5173
```

- Without keys: the app loads with **sample training data**; the engine readiness works; chat/plan show
  a "configure OpenRouter" notice.
- With `OPENROUTER_API_KEY`: the **Coach** chats and generates a weekly plan (pick any model via
  `OPENROUTER_MODEL`, incl. free `:free` slugs).
- With a **Strava** app configured: click *Connect Strava* to use your own activities.

```bash
npm test            # engine unit + golden tests (22)
npm run typecheck   # all workspaces
```

## Calibrate against your own data (legal)

The engine's weights/thresholds are literature-grounded defaults, not any app's actual values. Record
your **own** observed input→recommendation pairs from RestOrTrain in
[`evidence/owner-observations.json`](evidence/owner-observations.json); `npm test` reports a match rate.
See [`docs/00-scope.md`](docs/00-scope.md) for why this (and using your own Strava/Garmin data) is legal.

## License

MIT (see package.json). Original work only.
