# 05 — Roadmap

## Stage 1 — MVP (this iteration)
**Scope:** pure decision engine + minimal React daily check-in → recommendation UI, local persistence.
**Acceptance criteria:**
- `recommend(input)` implements `02-behaviour-spec.md` exactly.
- Unit tests for CTL/ATL/TSB, ACWR, baseline/SWC, and every sub-score pass.
- Golden tests pass for: good recovery → TRAIN_HARD; moderate → TRAIN_EASY; poor → REST; each hard
  override (HRV suppressed, high RHR, <4 h sleep) → REST; ACWR ≥ 1.5 caps.
- `npm test`, `npm run typecheck` clean; `npm run dev` serves the UI; a check-in yields a
  recommendation with an explanation; entries persist across reload.

## Stage 2 — Persistence & history
Charts of readiness/CTL/ATL/TSB over time; edit past entries; export/import JSON.

## Stage 3 — Integrations (needs OAuth + real accounts; out of MVP)
Import HRV/RHR/sleep/activities from Apple Health, Garmin Connect, Intervals.icu, etc. Secrets via
`.env` only.

## Stage 4 — Polish
Onboarding, per-athlete calibration of baselines/SWC, config UI for weights/thresholds, accessibility
and responsive pass.
