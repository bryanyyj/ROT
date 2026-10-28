// Validation harness against the owner's own black-box observations of RestOrTrain
// (legal: owner's own account/data; see docs/00-scope.md). This does NOT hard-fail on
// mismatches — divergences are informative, not bugs — it reports a match rate the
// validation report (docs/06-validation-report.md) records. It asserts only that the
// engine produces a valid recommendation for every observation.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { recommend } from "../src/readiness.js";
import type { Likert, ReadinessInput, Recommendation } from "../src/types.js";

interface Observation {
  date: string;
  observed: Recommendation;
  input: {
    rmssd?: number;
    restingHr?: number;
    sleepHours?: number;
    sleepQuality?: Likert;
    soreness?: Likert;
    fatigue?: Likert;
    stress?: Likert;
    motivation?: Likert;
    sessionLoad?: number;
  };
  hrvHistory?: number[];
  rhrHistory?: number[];
  sessionLoads?: number[];
}

function loadObservations(): Observation[] {
  const here = dirname(fileURLToPath(import.meta.url));
  const path = resolve(here, "../../../evidence/owner-observations.json");
  try {
    const data = JSON.parse(readFileSync(path, "utf8")) as { observations?: Observation[] };
    return data.observations ?? [];
  } catch {
    return [];
  }
}

const ln = (ms: number) => Math.log(ms);

function toInput(o: Observation): ReadinessInput {
  const input: ReadinessInput = {
    sleepHours: o.input.sleepHours,
    sleepQuality: o.input.sleepQuality,
    soreness: o.input.soreness,
    fatigue: o.input.fatigue,
    stress: o.input.stress,
    motivation: o.input.motivation,
  };
  if (o.input.rmssd !== undefined) input.hrvLnRmssd = ln(o.input.rmssd);
  if (o.input.restingHr !== undefined) input.restingHr = o.input.restingHr;
  if (o.hrvHistory) input.hrvHistory = o.hrvHistory.map(ln);
  if (o.rhrHistory) input.rhrHistory = o.rhrHistory;
  if (o.sessionLoads) {
    input.sessionLoads = [...o.sessionLoads, o.input.sessionLoad ?? 0];
  } else if (o.input.sessionLoad !== undefined) {
    input.sessionLoads = [o.input.sessionLoad];
  }
  return input;
}

describe("owner black-box validation [Runtime-observed, owner account]", () => {
  const observations = loadObservations();

  it("engine produces a valid recommendation for every owner observation", () => {
    const valid: Recommendation[] = ["TRAIN_HARD", "TRAIN_EASY", "REST"];
    for (const o of observations) {
      const r = recommend(toInput(o));
      expect(valid).toContain(r.recommendation);
    }
  });

  it("reports match rate vs. RestOrTrain's own-account recommendations", () => {
    if (observations.length === 0) {
      console.log(
        "[validation] No owner observations yet. Add input→recommendation pairs to " +
          "evidence/owner-observations.json to compute a match rate.",
      );
      return;
    }
    let matches = 0;
    const divergences: string[] = [];
    for (const o of observations) {
      const got = recommend(toInput(o)).recommendation;
      if (got === o.observed) matches += 1;
      else divergences.push(`  ${o.date}: observed ${o.observed}, engine ${got}`);
    }
    const rate = ((matches / observations.length) * 100).toFixed(1);
    console.log(`[validation] Match rate: ${matches}/${observations.length} (${rate}%)`);
    if (divergences.length) console.log("[validation] Divergences:\n" + divergences.join("\n"));
    expect(matches).toBeLessThanOrEqual(observations.length);
  });
});
