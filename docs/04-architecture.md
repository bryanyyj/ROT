# 04 — Architecture & ADRs

## Overview

```
ROT/ (npm workspaces)
├─ packages/engine        # pure decision engine — no UI, no I/O, no deps
│  ├─ src/
│  │  ├─ types.ts         # Input/Output types
│  │  ├─ config.ts        # all weights/thresholds/time-constants (single source of truth)
│  │  ├─ trainingLoad.ts  # CTL/ATL/TSB, ACWR, baseline/SWC helpers
│  │  ├─ readiness.ts     # recommend(input) -> result  (the core pure function)
│  │  └─ index.ts         # public exports
│  └─ test/               # Vitest unit + golden tests (each cites EV-### ids)
└─ apps/web               # React + Vite + TypeScript UI (daily check-in -> recommendation)
   └─ src/                # imports @rot/engine; localStorage persistence
```

## ADR-001 — Pure functional decision engine, framework-agnostic
**Decision:** The engine is pure TypeScript with no runtime dependencies and no I/O. `recommend(input)`
is a deterministic pure function. **Why:** fully unit-testable (golden tests), reusable by any
front-end (web now, mobile later), and keeps the auditable logic isolated from UI concerns. Matches the
PRD's "decision engine separate from UI/IO" requirement.

## ADR-002 — All tunables centralised in `config.ts`
**Decision:** Every weight, threshold, time-constant and band lives in one exported config object.
**Why:** the spec values are our choices grounded in literature; centralising them makes them
auditable, diffable, and tunable without touching logic. Tests can import the same constants.

## ADR-003 — React + Vite for the web app
**Decision:** `apps/web` uses React + Vite + TypeScript. **Why:** owner requested React; Vite gives a
fast one-command dev/build with first-class TS and workspace imports. No backend needed for MVP.

## ADR-004 — Local persistence for MVP
**Decision:** Daily entries persist in `localStorage` (JSON). **Why:** no accounts/secrets/servers for
MVP; keeps everything on the owner's device (aligns with the legal/privacy posture). A real datastore
and wearable integrations are deferred.

## ADR-005 — Explainability is a first-class output
**Decision:** The engine returns `drivers[]` (plain-English reasons) and all sub-scores, not just a
label. **Why:** the value of the category is *why* to rest or train; also makes behaviour testable and
debuggable.

## Data model (MVP)

`DailyEntry` = check-in fields + optional session load for the day, keyed by ISO date. History arrays
for the engine are derived by reading the last N entries from `localStorage`.

## Testing strategy

- **Unit tests:** each helper (CTL/ATL, ACWR, baseline/SWC, each sub-score) against hand-computed
  values, citing the relevant EV id.
- **Golden tests:** whole-input → expected `{recommendation, score-band}` scenarios covering the happy
  paths, every hard override, and the ACWR caps. See `05-roadmap.md` acceptance criteria and
  `06-validation-report.md`.
