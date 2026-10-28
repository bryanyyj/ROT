import { describe, expect, it } from "vitest";
import { computeLoad } from "@rot/engine";
import { dailyLoadSeries, formHistory } from "../src/coach.js";
import type { Activity } from "../src/types.js";

const act = (date: string, load: number): Activity => ({ id: date, date, type: "Run", durationMin: 30, trainingLoad: load, source: "strava" });

describe("formHistory", () => {
  const days = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10));
  const activities = days.filter((_, i) => i % 2 === 0).map((d, i) => act(d, 40 + (i % 5) * 10));
  const asOf = days.at(-1)!;

  it("matches the engine's TSB for the final day and skips the warm-up", () => {
    const points = formHistory(activities, asOf);
    expect(points.at(-1)!.date).toBe(asOf);
    expect(points.length).toBe(days.length - 14);
    const { loads } = dailyLoadSeries(activities, asOf);
    expect(points.at(-1)!.tsb).toBeCloseTo(computeLoad(loads).tsb, 1);
  });
  it("is empty without activities", () => {
    expect(formHistory([], asOf)).toEqual([]);
  });
});
