# ROT — Project Handoff / Continuation Guide

Read this first when resuming on another machine. It summarises what this project is, the legal basis,
what's built, and exactly how to pick up where we left off.

**Repo:** https://github.com/bryanyyj/ROT · **Working branch:** `feat/rest-or-train-rebuild`
**Last updated:** 2026-10-28.

> **PIVOT (2026-10-28):** the project is now an **AI endurance coach** — a backend (`apps/server`)
> reads your real training data (Strava; Garmin deferred), the readiness engine grounds an **LLM via
> OpenRouter**, and the React **Coach** tab chats + plans your week. The original deterministic
> check-in is still there as the "Daily check-in" tab. To run the coach live you need
> `apps/server/.env` with `OPENROUTER_API_KEY` (see `.env.example`). Details: ADR-006..009 in
> `docs/04-architecture.md`.

---

## 1. What this project is

An **original "rest or train" training-readiness app**. You give it your recovery data (HRV, resting
HR, sleep) and recent training load; it recommends **TRAIN_HARD / TRAIN_EASY / REST** with a 0–100
readiness score and a plain-English explanation.

It was inspired by the paid iOS app **RestOrTrain**, but it is a **clean-room, independent build** — see
the legal note below. The original PRD (`RestOrTrain_REA_PRD.md`) proposed reverse-engineering the app
with REA; we deliberately did **not** do that.

## 2. Legal basis (important — don't undo this)

You do **not** own RestOrTrain, so we do **not** decompile it or copy its code/assets/branding. Instead:

- Core logic is built from **publicly documented sports science** (non-copyrightable methods), each
  cited in `docs/03-evidence-log.md`.
- You may legally record **your own account's** observed inputs→recommendations as a black-box
  reference to *calibrate/validate* our engine (`evidence/owner-observations.json`). No decompilation,
  no other users' data.

Full detail: `docs/00-scope.md`.

## 3. Current status (MVP complete)

- ✅ `packages/engine` — pure decision engine, **22 tests passing**, typecheck clean.
- ✅ `apps/web` — React + Vite daily check-in UI ("ReadyOrRest"), local persistence; builds + runs.
- ✅ Docs `00`–`06`, evidence log, model log.
- ✅ 0 npm vulnerabilities.
- ⏳ **Match-rate calibration against your own observations is PENDING your data.**

## 4. Repo layout

```
packages/engine/
  src/config.ts        # ALL weights/thresholds/time-constants (tune here)
  src/trainingLoad.ts  # CTL/ATL/TSB, ACWR, HRV baseline/SWC
  src/readiness.ts     # recommend(input) -> result  (core pure function)
  src/types.ts         # input/output types
  test/                # unit + golden + owner-observation harness
apps/web/
  src/App.tsx          # UI
  src/storage.ts       # localStorage + builds engine input from history
docs/                  # 00-scope ... 06-validation-report, evidence-log, model-log
evidence/owner-observations.json   # <-- put your own RestOrTrain data here
RestOrTrain_REA_PRD.md # original brief (for reference)
```

## 5. Resume on a new machine

```bash
git clone https://github.com/bryanyyj/ROT.git
cd ROT
git checkout feat/rest-or-train-rebuild
npm install                           # needs Node >= 22.19
cp .env.example apps/server/.env      # add OPENROUTER_API_KEY (+ optional Strava)
npm run dev --workspace apps/server   # API  http://localhost:8787
npm run dev --workspace apps/web      # UI   http://localhost:5173
npm test                              # 22 engine tests
```

## 6. Next steps (where to continue)

1. **Calibrate (highest value):** add a handful of real input→recommendation pairs from your own
   RestOrTrain account to `evidence/owner-observations.json`, run `npm test` to see the match rate,
   then tune `packages/engine/src/config.ts` weights/thresholds toward ≥90% match. Record results in
   `docs/06-validation-report.md`.
2. Rename the app from the placeholder "ReadyOrRest" if desired (search `apps/web`).
3. Roadmap stages (`docs/05-roadmap.md`): charts/history view → wearable integrations (Apple Health /
   Garmin / Intervals.icu, needs OAuth + `.env`) → polish.
4. Open a PR to `main` when ready (see `docs/00-scope.md` rule: don't merge to main without approval).

## 7. Conventions

- Work on `feat/rest-or-train-rebuild`; conventional commits; no secrets in git (use `.env`, see
  `.env.example`).
- Every behaviour claim cites an `EV-###` id in `docs/03-evidence-log.md`.
