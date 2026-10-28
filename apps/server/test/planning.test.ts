import { describe, expect, it } from "vitest";
import { formatVolume, isPlanRequest, volumeBaseline } from "../src/planning.js";
import type { Activity } from "../src/types.js";

const TODAY = "2026-10-28"; // Wednesday; current week starts Mon 2026-10-26
const run = (date: string, min: number): Activity => ({ id: date, date, type: "Run", durationMin: min, source: "strava" });

describe("volumeBaseline", () => {
  it("builds from the last week when volume isn't in a deload spot", () => {
    const v = volumeBaseline([run("2026-10-19", 60), run("2026-10-12", 90), run("2026-10-05", 60)], TODAY);
    expect(v.weeks).toEqual([0, 60, 90, 60]);
    expect(v.mode).toBe("build");
    expect(v.targetMin).toBe(90); // after a down week, back to the peak
  });
  it("never targets below last week in a build", () => {
    const v = volumeBaseline([run("2026-10-19", 100), run("2026-10-12", 90), run("2026-10-05", 100), run("2026-09-28", 95)], TODAY);
    expect(v.mode).toBe("build");
    expect(v.targetMin).toBeGreaterThanOrEqual(100);
  });
  it("calls a deload after three loading weeks, or when forced", () => {
    const acts = [run("2026-09-28", 60), run("2026-10-05", 70), run("2026-10-12", 80), run("2026-10-19", 90)];
    expect(volumeBaseline(acts, TODAY).mode).toBe("deload");
    expect(volumeBaseline(acts, TODAY).targetMin).toBe(65);
    expect(volumeBaseline([run("2026-10-19", 60)], TODAY, true).mode).toBe("deload");
  });
  it("reports typical sessions by weekday and handles no history", () => {
    const v = volumeBaseline([run("2026-10-19", 60), run("2026-10-12", 80)], TODAY);
    expect(v.typical).toEqual([{ weekday: 0, sport: "Run", minutes: 70 }]);
    expect(formatVolume(v)).toContain("Mon Run 70min");
    expect(formatVolume(volumeBaseline([], TODAY))).toContain("no completed weeks");
  });
});

describe("isPlanRequest", () => {
  it("matches planning chat but not casual questions", () => {
    expect(isPlanRequest("Plan my week around a long ride")).toBe(true);
    expect(isPlanRequest("make saturday longer")).toBe(true);
    expect(isPlanRequest("How's my form looking?")).toBe(false);
  });
});
