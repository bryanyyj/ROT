// Training-load maths: CTL/ATL/TSB, ACWR, and baseline/SWC helpers.
// Pure functions, no dependencies. See docs/02-behaviour-spec.md.

import { CONFIG } from "./config.js";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Sample standard deviation (n−1). Returns 0 for <2 values. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Exponentially-weighted moving average over a series, seeded at 0.
 * X_today = X_yday + (load − X_yday) / tau.  [EV-002]
 */
export function ewma(series: number[], tau: number): number {
  let x = 0;
  for (const load of series) {
    x = x + (load - x) / tau;
  }
  return x;
}

export interface LoadResult {
  ctl: number;
  atl: number;
  tsb: number;
  acwr?: number;
}

/** CTL/ATL/TSB (+ ACWR when enough history). [EV-002][EV-003] */
export function computeLoad(sessionLoads: number[]): LoadResult {
  const ctl = ewma(sessionLoads, CONFIG.loadTau.ctl);
  const atl = ewma(sessionLoads, CONFIG.loadTau.atl);
  const tsb = ctl - atl;
  const acwr = computeAcwr(sessionLoads);
  return acwr === undefined ? { ctl, atl, tsb } : { ctl, atl, tsb, acwr };
}

/** Acute:chronic workload ratio. Undefined with <acuteDays of data or zero chronic load. [EV-003] */
export function computeAcwr(sessionLoads: number[]): number | undefined {
  const { acuteDays, chronicDays } = CONFIG.acwr;
  if (sessionLoads.length < acuteDays) return undefined;
  const acute = mean(sessionLoads.slice(-acuteDays));
  const chronic = mean(sessionLoads.slice(-chronicDays));
  if (chronic === 0) return undefined;
  return acute / chronic;
}

export interface HrvBaseline {
  baseline: number;
  swc: number;
  rolling: number;
}

/** Baseline (mean of history), SWC (0.5×SD), and 7-day rolling mean. [EV-005] */
export function hrvBaseline(hrvHistory: number[]): HrvBaseline {
  const baseline = mean(hrvHistory);
  const swc = CONFIG.hrv.swcSdFactor * stdDev(hrvHistory);
  const rolling = mean(hrvHistory.slice(-CONFIG.hrv.rollingDays));
  return { baseline, swc, rolling };
}
