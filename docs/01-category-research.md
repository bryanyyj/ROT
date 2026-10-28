# 01 — Category Research (public sources only)

All findings come from public material and published sports science. Each is tagged with an evidence
id from `03-evidence-log.md`. No third-party app was decompiled; no proprietary content is reproduced.

## 1. The category [EV-001]

"Training-readiness" apps answer one daily question: **should I train hard, go easy, or rest?** They
combine **recovery signals** (HRV, resting heart rate, sleep) with **training load** (how much work
you've done recently vs. your long-term norm) and often **subjective input** (soreness, fatigue,
notes). Output is a recommendation plus, usually, a readiness score and a short explanation. This is a
well-populated category (WHOOP, Oura, Garmin Body Battery/Training Readiness, HRV4Training,
Intervals.icu, ithlete, etc.), so the *concept* is generic and non-proprietary.

## 2. Publicly documented methods we will implement

These are published scientific methods — formulas and concepts — not any app's code.

### 2.1 Training-load model: CTL / ATL / TSB [EV-002]
- **CTL (fitness)** = exponentially-weighted moving average of daily load, time constant **42 days**.
- **ATL (fatigue)** = same, time constant **7 days**.
- **TSB (form)** = CTL − ATL. Positive TSB = fresh; strongly negative = fatigued.
- Recursive update: `X_today = X_yesterday + (load_today − X_yesterday) / τ`.

### 2.2 Per-session load [EV-004]
A single daily number from **duration × intensity** (TSS-style) or HR-based **TRIMP (Banister)**. This
feeds CTL/ATL so the model works even without proprietary power metrics.

### 2.3 Acute:Chronic Workload Ratio (ACWR) [EV-003]
- Acute load = ~7-day average; chronic load = ~28-day average; **ACWR = acute / chronic**.
- **Sweet spot ≈ 0.8–1.3**; injury risk rises above **~1.5** (and very low values indicate
  detraining/undertraining).

### 2.4 HRV-guided readiness [EV-005]
- Use **ln rMSSD**. Compare today's **7-day rolling mean** to a longer baseline.
- **Smallest Worthwhile Change (SWC) ≈ 0.5 × within-athlete SD** defines a noise band; values below the
  band indicate parasympathetic suppression → bias toward rest; within band → normal.

### 2.5 Resting HR [EV-006]
Resting HR elevated vs. personal baseline → accumulated fatigue / under-recovery / possible illness →
bias toward rest.

### 2.6 Sleep & subjective wellness [EV-007]
Short/poor sleep and high soreness/fatigue/stress (simple self-report, Hooper-style) reduce readiness.

## 3. How this maps to our build

We implement a transparent, explainable engine: each input produces a sub-score; a weighted
combination yields a 0–100 **readiness score**; score bands plus hard-override rules (e.g. very
suppressed HRV, ACWR in the danger zone, illness-level RHR) produce the recommendation
`{ TRAIN_HARD | TRAIN_EASY | REST }` with a plain-English explanation. Exact weights, thresholds and
bands are specified in `02-behaviour-spec.md` and centralised in `packages/engine/src/config.ts`.

## 4. Explicit non-goals / unknowns

- We do **not** know or reproduce RestOrTrain's actual weights, thresholds, or model — those are
  proprietary and were not inspected. Our numbers come from the public literature above and are tuned
  for sensible behaviour, not to match any specific app (`UNKNOWN` where literature is silent).
