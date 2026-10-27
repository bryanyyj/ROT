# 06 — Validation Report

_Date: 2026-10-27. Stage 1 (MVP)._

## Automated checks

| Check | Command | Result |
|---|---|---|
| Engine unit + golden tests | `npm test` | **22 passed** (3 files) |
| Engine typecheck | `npm run typecheck` (packages/engine) | clean |
| Web typecheck | `npm run typecheck` (apps/web) | clean |
| Web production build | `npm run build --workspace apps/web` | clean (20 modules) |
| Dev server boot | `npm run dev` | HTTP 200, serves app + transformed TS |
| Dependency audit | `npm audit` | **0 vulnerabilities** |

## Golden set 1 — published-formula scenarios (`test/readiness.test.ts`)

Derived from the behaviour spec and public literature (not from any app). All pass:

- Good recovery → **TRAIN_HARD** (High confidence).
- Moderate recovery → **TRAIN_EASY**.
- Poor recovery (no override) → **REST**.
- Override: HRV strongly suppressed → **REST** [EV-005].
- Override: illness-level resting HR → **REST** [EV-006].
- Override: severe sleep (<4 h) → **REST** [EV-007].
- ACWR ≥ 1.5 spike caps TRAIN_HARD → **TRAIN_EASY** [EV-003].
- Edge cases: no inputs → Low confidence; out-of-range clamped.

Unit maths (`test/trainingLoad.test.ts`): EWMA/CTL/ATL, ACWR (undefined <7 d, 1.0 steady, 1.6 spike),
HRV baseline/SWC, mean/stdDev/clamp — all verified against hand-computed values.

## Golden set 2 — owner black-box observations (`test/ownerObservations.test.ts`)

Harness compares the engine's recommendation to what RestOrTrain told the **owner on his own account**
(legal reference data; `evidence/owner-observations.json`). It reports a match rate and lists
divergences without hard-failing (divergences are informative).

**Status: PENDING OWNER DATA.** `evidence/owner-observations.json` currently has 0 observations, so no
match rate can be computed yet. Once the owner adds input→recommendation pairs, `npm test` prints the
match rate; the target (success criteria) is **≥ 90%** on in-scope cases, and each divergence will be
classified here as *bug / deliberate difference / unknown original behaviour*.

| Match rate | Divergences | Classification |
|---|---|---|
| _pending_ | _pending_ | _pending_ |

## Known limitations

- Weights/thresholds (`config.ts`) are literature-grounded defaults, **not** RestOrTrain's actual
  values (those are proprietary and were not inspected). Calibration against owner observations is the
  intended way to tune them.
- No wearable integrations yet (manual/mock input) — Stage 3.
- HRV is entered as rMSSD and ln-transformed; a <7-day history disables the HRV sub-score.
