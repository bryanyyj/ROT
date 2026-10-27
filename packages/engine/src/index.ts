// @rot/engine — pure rest-or-train decision engine. See docs/02-behaviour-spec.md.

export const ENGINE_VERSION = "0.1.0";

export { recommend } from "./readiness.js";
export { CONFIG } from "./config.js";
export {
  computeLoad,
  computeAcwr,
  hrvBaseline,
  ewma,
  mean,
  stdDev,
  clamp,
} from "./trainingLoad.js";
export type {
  ReadinessInput,
  ReadinessResult,
  Recommendation,
  Confidence,
  SubScores,
  LoadMetrics,
  Likert,
} from "./types.js";
