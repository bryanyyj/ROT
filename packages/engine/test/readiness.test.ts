import { describe, it, expect } from "vitest";
import { recommend } from "../src/readiness.js";
import { CONFIG } from "../src/config.js";
import type { ReadinessInput } from "../src/types.js";

const steadyLoads = Array(28).fill(50);
const flatHrvHistory = [4, 4, 4, 4, 4, 4, 4]; // swc = 0 -> hrv score = base (80)
const lowRhrHistory = [50, 50, 50];

describe("golden scenarios [EV-002..EV-007]", () => {
  it("good recovery -> TRAIN_HARD", () => {
    const input: ReadinessInput = {
      hrvLnRmssd: 4,
      hrvHistory: flatHrvHistory,
      restingHr: 50,
      rhrHistory: lowRhrHistory,
      sleepHours: 8,
      sleepQuality: 5,
      soreness: 1,
      fatigue: 1,
      stress: 1,
      motivation: 5,
      sessionLoads: steadyLoads,
    };
    const r = recommend(input);
    expect(r.recommendation).toBe("TRAIN_HARD");
    expect(r.readinessScore).toBeGreaterThanOrEqual(CONFIG.bands.trainHardMin);
    expect(r.confidence).toBe("High");
  });

  it("moderate recovery -> TRAIN_EASY", () => {
    const input: ReadinessInput = {
      hrvLnRmssd: 4,
      hrvHistory: flatHrvHistory,
      restingHr: 53,
      rhrHistory: lowRhrHistory,
      sleepHours: 7,
      sleepQuality: 3,
      soreness: 3,
      fatigue: 4,
      stress: 3,
      motivation: 3,
      sessionLoads: steadyLoads,
    };
    const r = recommend(input);
    expect(r.recommendation).toBe("TRAIN_EASY");
    expect(r.readinessScore).toBeGreaterThanOrEqual(CONFIG.bands.trainEasyMin);
    expect(r.readinessScore).toBeLessThan(CONFIG.bands.trainHardMin);
  });

  it("poor recovery (no override) -> REST", () => {
    const input: ReadinessInput = {
      restingHr: 56, // +6 vs baseline, not illness-level
      rhrHistory: lowRhrHistory,
      sleepHours: 4.5, // low but not <4
      sleepQuality: 1,
      soreness: 5,
      fatigue: 5,
      stress: 5,
      motivation: 1,
      sessionLoads: steadyLoads,
    };
    const r = recommend(input);
    expect(r.recommendation).toBe("REST");
    expect(r.readinessScore).toBeLessThan(CONFIG.bands.trainEasyMin);
  });
});

describe("hard overrides force REST", () => {
  const base: ReadinessInput = {
    sleepHours: 8,
    sleepQuality: 5,
    soreness: 1,
    fatigue: 1,
    stress: 1,
    motivation: 5,
    sessionLoads: steadyLoads,
  };

  it("HRV strongly suppressed -> REST [EV-005]", () => {
    const hist = [4.0, 4.1, 3.9, 4.0, 4.1, 3.9, 4.0]; // swc ~ 0.04
    const r = recommend({ ...base, hrvHistory: hist, hrvLnRmssd: 3.0 });
    expect(r.recommendation).toBe("REST");
    expect(r.drivers.some((d) => /HRV strongly suppressed/.test(d))).toBe(true);
  });

  it("illness-level resting HR -> REST [EV-006]", () => {
    const r = recommend({ ...base, restingHr: 58, rhrHistory: [50] }); // +8 > 7
    expect(r.recommendation).toBe("REST");
    expect(r.drivers.some((d) => /resting HR/.test(d))).toBe(true);
  });

  it("severe sleep deprivation (<4h) -> REST [EV-007]", () => {
    const r = recommend({ ...base, sleepHours: 3, sleepQuality: 3 });
    expect(r.recommendation).toBe("REST");
    expect(r.drivers.some((d) => /severe sleep/i.test(d))).toBe(true);
  });
});

describe("ACWR injury-spike cap [EV-003]", () => {
  it("great recovery but load spike caps TRAIN_HARD -> TRAIN_EASY", () => {
    const spikeLoads = [...Array(21).fill(40), ...Array(7).fill(80)]; // ACWR ~1.6
    const input: ReadinessInput = {
      hrvLnRmssd: 4,
      hrvHistory: flatHrvHistory,
      restingHr: 50,
      rhrHistory: lowRhrHistory,
      sleepHours: 8,
      sleepQuality: 5,
      soreness: 1,
      fatigue: 1,
      stress: 1,
      motivation: 5,
      sessionLoads: spikeLoads,
    };
    const r = recommend(input);
    expect(r.metrics.acwr).toBeGreaterThanOrEqual(CONFIG.acwr.dangerHigh);
    expect(r.recommendation).toBe("TRAIN_EASY");
    expect(r.drivers.some((d) => /spike/.test(d))).toBe(true);
  });
});

describe("edge cases", () => {
  it("no inputs -> Low confidence", () => {
    const r = recommend({});
    expect(r.confidence).toBe("Low");
    expect(r.subScores.form).toBe(CONFIG.form.neutralScore);
  });

  it("out-of-range sleep is clamped (no crash, bounded score)", () => {
    const r = recommend({ sleepHours: 20, sleepQuality: 5, sessionLoads: steadyLoads });
    expect(r.subScores.sleep).toBeLessThanOrEqual(100);
    expect(r.subScores.sleep).toBeGreaterThanOrEqual(0);
  });
});
