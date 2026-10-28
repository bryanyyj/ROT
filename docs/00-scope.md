# 00 — Scope, Authorisation & Legal Basis

**Project:** ROT — an original "rest or train" training-readiness app.
**Owner:** Bryan Yeo.
**Date:** 2026-10-27.
**Branch:** `feat/rest-or-train-rebuild`.

## Authorisation (replaces PRD Section 2)

The owner **does not own** RestOrTrain and does not have permission to analyse its code. RestOrTrain is a third-party, paid iOS app. The owner likes the app and wants to build his own version of the *concept*, with the explicit instruction: **"do what is legal."**

**Consequence — the project is a clean-room, independent creation, not a reverse-engineering effort.** The PRD's REA / decompilation / `.ipa` analysis approach is **not used**, because the owner does not own the binary and decompiling a third-party paid app would breach its terms and risk copyright/anti-circumvention law.

### Legal guardrails (binding)

- ❌ No downloading, decompiling, disassembling, or inspecting the RestOrTrain binary.
- ❌ No copying RestOrTrain's name, logo, UI, screenshots, marketing copy, or any proprietary dataset.
- ❌ No circumvention of authentication, licensing, or paywalls; no collecting other users' data.
- ✅ Research limited to **public** material: the vendor's public marketing/FAQ pages, the public App Store listing, third-party reviews, and peer-reviewed / publicly documented sports-science methods.
- ✅ The rebuild uses **original branding** and original code. Working placeholder name: **"ReadyOrRest"** (owner to confirm/replace).
- ✅ The core logic is built from **non-copyrightable scientific methods** (formulas and concepts), each cited in `03-evidence-log.md`.
- ✅ **Pulling the owner's OWN training data via official provider OAuth** (Strava, Garmin, Intervals.icu) is permitted and legal — it is the owner's own data accessed through each provider's sanctioned API.
- ✅ **Black-box behavioural observation of the owner's OWN account** is permitted: as a legitimate paying user, the owner may record the inputs he sees and the recommendations RestOrTrain gives him, and share those input→output pairs. These are used only to *calibrate and validate* our independent engine (a golden reference set), never to copy code or assets. Recorded as `Runtime-observed (owner account)` evidence; stored in `evidence/owner-observations.json`.

This is legally sound because ideas, concepts, and scientific/mathematical methods are not protected by copyright — only a specific expression (code, assets, text) is, and none of RestOrTrain's expression is used. Observing the behaviour of an app one legitimately uses, on one's own data, and building independent logic from those observations, is the standard clean-room black-box approach (no decompilation, no other users' data).

## Discovery answers (PRD Section 3)

1. **Platform of RestOrTrain:** iOS app (per public App Store listing). *We do not analyse it; recorded for context only.*
2. **Artifact location:** N/A — we deliberately do not obtain or analyse the artifact. Understanding comes from public sources only.
3. **What the owner cares about most:** primarily the **rest-vs-train decision logic**; secondarily the data model and UI flow. Wearable integrations are a later stage.
4. **Preferred stack:** TypeScript + a simple web UI (PRD default; the `ROT` repo was empty).
5. **Model strategy:** proceeding with Claude Code (Opus) as executor. The PRD's "free model first" principle is waived by owner choice — see `model-log.md`.

## What RestOrTrain is (public understanding only)

An AI training-readiness coach for cyclists/triathletes/runners that uses recovery data (HRV, sleep, resting heart rate) and training load to recommend **train hard / go easy / rest**, and integrates with Garmin, Apple Health, COROS, Intervals.icu, WHOOP, and others. (See `01-category-research.md` for cited public sources.)

## In / out of scope for this build

- **In scope (MVP):** an explainable rest-vs-train decision engine (pure functions) + a minimal daily check-in → recommendation web UI, with local persistence.
- **Out of scope (later stages):** live wearable/health integrations (OAuth + real accounts), season planning, structured-workout generation, device push.
