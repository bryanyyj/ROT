// Single source of truth for all weights, thresholds, time-constants and bands.
// Values are OUR choices grounded in public literature (see docs/03-evidence-log.md),
// not reproductions of any third-party app. Tune here without touching logic.

export const CONFIG = {
  /** EWMA time constants for training load. [EV-002] */
  loadTau: { ctl: 42, atl: 7 },

  /** ACWR windows and bands. [EV-003] */
  acwr: {
    acuteDays: 7,
    chronicDays: 28,
    sweetSpotLow: 0.8,
    sweetSpotHigh: 1.3,
    dangerHigh: 1.5,
  },

  /** HRV baseline/SWC and suppression override. [EV-005] */
  hrv: {
    rollingDays: 7,
    minHistory: 7,
    swcSdFactor: 0.5,
    /** z = (rolling − baseline) / SWC ; score = clamp(base + slope·z). */
    scoreBase: 80,
    scoreSlope: 20,
    /** Force REST when rolling mean < baseline − suppressZ·SWC. */
    suppressZ: 2,
  },

  /** Resting-HR scoring and illness override. [EV-006] */
  rhr: {
    /** score = 100 − penaltyPerBpm·max(0, delta). */
    penaltyPerBpm: 8,
    /** Force REST when delta > illnessDeltaBpm. */
    illnessDeltaBpm: 7,
  },

  /** Sleep scoring and deprivation override. [EV-007] */
  sleep: {
    optimalHours: 7.5,
    hoursWeight: 0.6,
    qualityWeight: 0.4,
    /** Force REST below this. */
    severeHours: 4,
  },

  /** Form (TSB) → score mapping. [EV-002] */
  form: {
    /** score = clamp(base + slope·TSB). */
    scoreBase: 50,
    scoreSlope: 2,
    neutralScore: 50,
  },

  /** Weights for the readiness score (renormalised over present sub-scores). */
  weights: {
    hrv: 0.3,
    sleep: 0.2,
    subjective: 0.2,
    rhr: 0.15,
    form: 0.15,
  },

  /** Readiness-score bands → base recommendation. */
  bands: {
    trainHardMin: 66,
    trainEasyMin: 40,
  },
} as const;

export type EngineConfig = typeof CONFIG;
