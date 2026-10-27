// Public types for the rest-or-train decision engine.
// See docs/02-behaviour-spec.md.

export type Recommendation = "TRAIN_HARD" | "TRAIN_EASY" | "REST";
export type Confidence = "High" | "Med" | "Low";

/** A 1–5 Likert rating. */
export type Likert = 1 | 2 | 3 | 4 | 5;

export interface ReadinessInput {
  /** Natural log of today's rMSSD (ms). Optional. [EV-005] */
  hrvLnRmssd?: number;
  /** Today's morning resting heart rate (bpm). Optional. [EV-006] */
  restingHr?: number;
  /** Last night's sleep in hours (0–14). [EV-007] */
  sleepHours?: number;
  /** Subjective sleep quality 1 (poor) – 5 (great). [EV-007] */
  sleepQuality?: Likert;
  /** Muscle soreness 1 (none) – 5 (severe). [EV-007] */
  soreness?: Likert;
  /** Perceived fatigue 1 (fresh) – 5 (exhausted). [EV-007] */
  fatigue?: Likert;
  /** Life/mental stress 1 (calm) – 5 (very stressed). [EV-007] */
  stress?: Likert;
  /** Motivation to train 1 (none) – 5 (high). [EV-007] */
  motivation?: Likert;

  /** Recent ln rMSSD values (most-recent-last), up to ~60, for baseline + SWC. [EV-005] */
  hrvHistory?: number[];
  /** Recent resting-HR values for baseline. [EV-006] */
  rhrHistory?: number[];
  /** Daily training load (TSS/TRIMP units), most-recent-last. [EV-002][EV-003][EV-004] */
  sessionLoads?: number[];
}

export interface SubScores {
  hrv?: number;
  rhr?: number;
  sleep?: number;
  subjective?: number;
  form?: number;
}

export interface LoadMetrics {
  ctl: number;
  atl: number;
  tsb: number;
  acwr?: number;
}

export interface ReadinessResult {
  recommendation: Recommendation;
  readinessScore: number;
  subScores: SubScores;
  metrics: LoadMetrics;
  drivers: string[];
  confidence: Confidence;
}
