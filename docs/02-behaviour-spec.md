# 02 — Behaviour Specification

The rest-or-train decision engine. All numbers are **our choices, grounded in the public literature**
(evidence ids), not reproductions of any app. Weights/thresholds live in one place
(`packages/engine/src/config.ts`) so they are auditable and tunable. Confidence: **High** = directly
from a published method; **Med** = reasonable mapping we chose; **Low** = assumption.

## Inputs

**Daily check-in (today):**
- `hrvLnRmssd` — natural-log of rMSSD (ms). Optional. [EV-005]
- `restingHr` — morning resting HR (bpm). Optional. [EV-006]
- `sleepHours` (0–14), `sleepQuality` (1–5). [EV-007]
- `soreness`, `fatigue`, `stress`, `motivation` — each 1–5. [EV-007]

**History:**
- `hrvHistory` — recent `hrvLnRmssd` values (≤60) for baseline/SWC. [EV-005]
- `rhrHistory` — recent resting-HR values for baseline. [EV-006]
- `sessionLoads` — daily training load (TSS/TRIMP units), most-recent-last, for CTL/ATL/TSB/ACWR. [EV-002][EV-003][EV-004]

## Derived training-load metrics

- **CTL / ATL** — EWMA of `sessionLoads`, `X_today = X_yday + (load − X_yday)/τ`, `τ_CTL = 42`, `τ_ATL = 7`, seeded at 0. [EV-002] (High)
- **TSB = CTL − ATL** (form). [EV-002] (High)
- **ACWR** = mean(last 7 loads) / mean(last 28 loads). Undefined if <7 days of data. [EV-003] (High)

## Sub-scores (each 0–100, higher = more ready)

| Sub-score | Formula | Evidence | Conf |
|---|---|---|---|
| **HRV** | `z = (mean(last7 hrv) − baseline) / SWC`, `baseline = mean(hrvHistory)`, `SWC = 0.5 × SD(hrvHistory)`; `hrv = clamp(80 + 20·z, 0, 100)` | [EV-005] | High |
| **RHR** | `delta = restingHr − mean(rhrHistory)`; `rhr = clamp(100 − 8·max(0, delta), 0, 100)` | [EV-006] | Med |
| **Sleep** | `hoursScore = clamp(sleepHours/7.5·100, 0, 100)`; `qualityScore = sleepQuality/5·100`; `sleep = 0.6·hoursScore + 0.4·qualityScore` | [EV-007] | Med |
| **Subjective** | mean of: `(5−soreness)/4·100`, `(5−fatigue)/4·100`, `(5−stress)/4·100`, `(motivation−1)/4·100` | [EV-007] | Med |
| **Form (TSB)** | `form = clamp(50 + 2·TSB, 0, 100)` | [EV-002] | Med |

## Readiness score

Weighted mean of available sub-scores (default weights; renormalised over whatever is present):

| Sub-score | Weight |
|---|---|
| HRV | 0.30 |
| Sleep | 0.20 |
| Subjective | 0.20 |
| RHR | 0.15 |
| Form (TSB) | 0.15 |

`readiness = round(Σ(weightᵢ · scoreᵢ) / Σ weightᵢ)` over present sub-scores.

## Recommendation

Base band from readiness score:
- **≥ 66 → TRAIN_HARD**
- **40–65 → TRAIN_EASY**
- **< 40 → REST**

**Hard overrides → force REST** (any one), each added to the explanation: [EV-005][EV-006][EV-007]
- HRV strongly suppressed: `mean(last7 hrv) < baseline − 2·SWC`
- Illness-level RHR: `delta > 7 bpm`
- Severe sleep deprivation: `sleepHours < 4`

**ACWR caps** (injury-spike guard): [EV-003]
- `ACWR ≥ 1.5` and base = TRAIN_HARD → **cap at TRAIN_EASY** (overreaching risk).
- `ACWR ≥ 1.5` and base = TRAIN_EASY → **downgrade to REST**.
- `ACWR < 0.8` → no cap, but note "load is low — room to build".

## Output

```
{
  recommendation: "TRAIN_HARD" | "TRAIN_EASY" | "REST",
  readinessScore: number,          // 0–100
  subScores: { hrv?, rhr?, sleep?, subjective?, form? },
  metrics: { ctl, atl, tsb, acwr? },
  drivers: string[],               // plain-English reasons (incl. any override/cap)
  confidence: "High" | "Med" | "Low"  // Low if key inputs (HRV/history) missing
}
```

## Edge cases

- **<7 HRV values:** HRV sub-score omitted (weight redistributed); confidence ≤ Med. (Med)
- **No `sessionLoads`:** CTL/ATL/TSB = 0 → Form score = 50 (neutral); ACWR omitted. (Med)
- **No inputs at all:** return `REST`-biased low-confidence result with explanation "insufficient data". (Low)
- **Out-of-range inputs:** clamped to valid ranges before scoring. (Med)
