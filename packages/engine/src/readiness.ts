// Core rest-or-train decision engine. Pure, deterministic. See docs/02-behaviour-spec.md.

import { CONFIG } from "./config.js";
import {
  clamp,
  computeLoad,
  hrvBaseline,
  mean,
} from "./trainingLoad.js";
import type {
  Confidence,
  LoadMetrics,
  ReadinessInput,
  ReadinessResult,
  Recommendation,
  SubScores,
} from "./types.js";

function round(n: number): number {
  return Math.round(n);
}

export function recommend(input: ReadinessInput): ReadinessResult {
  const drivers: string[] = [];
  const subScores: SubScores = {};
  const weights = CONFIG.weights;
  const usedWeights: Record<string, number> = {};

  // ---- Training load (always computable) [EV-002][EV-003] ----
  const loads = input.sessionLoads ?? [];
  const load = computeLoad(loads);
  const metrics: LoadMetrics = { ctl: load.ctl, atl: load.atl, tsb: load.tsb };
  if (load.acwr !== undefined) metrics.acwr = load.acwr;

  // ---- HRV sub-score [EV-005] ----
  let hrvSuppressed = false;
  const hrvHistory = input.hrvHistory ?? [];
  if (input.hrvLnRmssd !== undefined && hrvHistory.length >= CONFIG.hrv.minHistory) {
    const combined = [...hrvHistory, input.hrvLnRmssd];
    const { baseline, swc } = hrvBaseline(hrvHistory);
    const rolling = mean(combined.slice(-CONFIG.hrv.rollingDays));
    const z = swc > 0 ? (rolling - baseline) / swc : 0;
    subScores.hrv = round(clamp(CONFIG.hrv.scoreBase + CONFIG.hrv.scoreSlope * z, 0, 100));
    usedWeights.hrv = weights.hrv;
    if (swc > 0 && rolling < baseline - CONFIG.hrv.suppressZ * swc) {
      hrvSuppressed = true;
    }
    if (z <= -1) drivers.push("HRV is below your baseline — parasympathetic suppression (under-recovered).");
    else if (z >= 1) drivers.push("HRV is above your baseline — well recovered.");
  }

  // ---- Resting-HR sub-score [EV-006] ----
  let rhrElevated = false;
  const rhrHistory = input.rhrHistory ?? [];
  if (input.restingHr !== undefined && rhrHistory.length >= 1) {
    const delta = input.restingHr - mean(rhrHistory);
    subScores.rhr = round(clamp(100 - CONFIG.rhr.penaltyPerBpm * Math.max(0, delta), 0, 100));
    usedWeights.rhr = weights.rhr;
    if (delta > CONFIG.rhr.illnessDeltaBpm) rhrElevated = true;
    if (delta > 3) drivers.push(`Resting HR elevated +${round(delta)} bpm vs baseline.`);
  }

  // ---- Sleep sub-score [EV-007] ----
  let severeSleep = false;
  if (input.sleepHours !== undefined && input.sleepQuality !== undefined) {
    const hoursScore = clamp((input.sleepHours / CONFIG.sleep.optimalHours) * 100, 0, 100);
    const qualityScore = (input.sleepQuality / 5) * 100;
    subScores.sleep = round(
      CONFIG.sleep.hoursWeight * hoursScore + CONFIG.sleep.qualityWeight * qualityScore,
    );
    usedWeights.sleep = weights.sleep;
    if (input.sleepHours < 6) drivers.push(`Short sleep (${input.sleepHours}h).`);
  }
  if (input.sleepHours !== undefined && input.sleepHours < CONFIG.sleep.severeHours) {
    severeSleep = true;
  }

  // ---- Subjective sub-score [EV-007] ----
  const subjectiveParts: number[] = [];
  if (input.soreness !== undefined) subjectiveParts.push(((5 - input.soreness) / 4) * 100);
  if (input.fatigue !== undefined) subjectiveParts.push(((5 - input.fatigue) / 4) * 100);
  if (input.stress !== undefined) subjectiveParts.push(((5 - input.stress) / 4) * 100);
  if (input.motivation !== undefined) subjectiveParts.push(((input.motivation - 1) / 4) * 100);
  if (subjectiveParts.length > 0) {
    subScores.subjective = round(mean(subjectiveParts));
    usedWeights.subjective = weights.subjective;
    if (subScores.subjective < 50) drivers.push("High soreness/fatigue/stress or low motivation.");
  }

  // ---- Form (TSB) sub-score — always present [EV-002] ----
  const formScore = loads.length > 0
    ? clamp(CONFIG.form.scoreBase + CONFIG.form.scoreSlope * metrics.tsb, 0, 100)
    : CONFIG.form.neutralScore;
  subScores.form = round(formScore);
  usedWeights.form = weights.form;
  if (loads.length > 0) {
    if (metrics.tsb < -10) drivers.push("Carrying fatigue — negative form (TSB).");
    else if (metrics.tsb > 5) drivers.push("Fresh — positive form (TSB).");
  }

  // ---- Weighted readiness score ----
  const weightSum = Object.values(usedWeights).reduce((a, b) => a + b, 0);
  let readinessScore = 50;
  if (weightSum > 0) {
    const weighted =
      (usedWeights.hrv ?? 0) * (subScores.hrv ?? 0) +
      (usedWeights.rhr ?? 0) * (subScores.rhr ?? 0) +
      (usedWeights.sleep ?? 0) * (subScores.sleep ?? 0) +
      (usedWeights.subjective ?? 0) * (subScores.subjective ?? 0) +
      (usedWeights.form ?? 0) * (subScores.form ?? 0);
    readinessScore = round(weighted / weightSum);
  }

  // ---- Base recommendation from band ----
  let recommendation: Recommendation =
    readinessScore >= CONFIG.bands.trainHardMin
      ? "TRAIN_HARD"
      : readinessScore >= CONFIG.bands.trainEasyMin
        ? "TRAIN_EASY"
        : "REST";

  // ---- Hard overrides -> force REST [EV-005][EV-006][EV-007] ----
  if (hrvSuppressed) {
    recommendation = "REST";
    drivers.push("Override: HRV strongly suppressed vs baseline → REST.");
  }
  if (rhrElevated) {
    recommendation = "REST";
    drivers.push("Override: resting HR elevated to illness-level → REST.");
  }
  if (severeSleep) {
    recommendation = "REST";
    drivers.push("Override: severe sleep deprivation (<4h) → REST.");
  }

  // ---- ACWR caps (injury-spike guard) [EV-003] ----
  if (metrics.acwr !== undefined) {
    if (metrics.acwr >= CONFIG.acwr.dangerHigh) {
      if (recommendation === "TRAIN_HARD") {
        recommendation = "TRAIN_EASY";
        drivers.push(`Cap: training-load spike (ACWR ${metrics.acwr.toFixed(2)} ≥ 1.5) → ease off.`);
      } else if (recommendation === "TRAIN_EASY") {
        recommendation = "REST";
        drivers.push(`Cap: training-load spike (ACWR ${metrics.acwr.toFixed(2)} ≥ 1.5) → REST.`);
      }
    } else if (metrics.acwr < CONFIG.acwr.sweetSpotLow) {
      drivers.push(`Training load is low (ACWR ${metrics.acwr.toFixed(2)}) — room to build.`);
    }
  }

  // ---- Confidence ----
  const haveCheckin =
    subScores.hrv !== undefined ||
    subScores.rhr !== undefined ||
    subScores.sleep !== undefined ||
    subScores.subjective !== undefined;
  let confidence: Confidence;
  if (!haveCheckin) {
    confidence = "Low";
    drivers.push("Low confidence: insufficient check-in data.");
  } else if (
    subScores.hrv !== undefined &&
    metrics.acwr !== undefined &&
    (subScores.sleep !== undefined || subScores.subjective !== undefined)
  ) {
    confidence = "High";
  } else {
    confidence = "Med";
  }

  if (drivers.length === 0) drivers.push("All signals within normal ranges.");

  return { recommendation, readinessScore, subScores, metrics, drivers, confidence };
}
