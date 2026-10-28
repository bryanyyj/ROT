import { describe, expect, it } from "vitest";
import { buildWorkoutProfile } from "../src/workout.js";
import { pastSessions } from "../src/coach.js";
import type { Activity } from "../src/types.js";

const ride: Activity = { id: "ride", date: "2026-10-20", type: "Ride", durationMin: 60, source: "import", avgPower: 180 };

describe("recorded workout profiles", () => {
  it("weights irregular samples by time and assigns supplied zones", () => {
    const profile = buildWorkoutProfile(ride, { time: { data: [0, 10, 30] }, watts: { data: [100, 200, 250] } }, [{ type: "power", distribution_buckets: [{ min: 0, max: 150 }, { min: 150, max: -1 }] }])!;
    expect(profile.bars[0]!.value).toBeCloseTo(400 / 3);
    expect(profile.bars[0]!.zone).toBe(1);
    expect(profile.bars[1]!.value).toBe(200);
    expect(profile.bars[1]!.zone).toBe(2);
    expect(profile.bars.at(-1)!.endSec).toBe(30);
  });
  it("prefers pace for runs and preserves stopped intervals", () => {
    const profile = buildWorkoutProfile({ ...ride, type: "TrailRun" }, { time: { data: [0, 10, 20] }, velocity_smooth: { data: [0, 4, 3] }, watts: { data: [100, 200, 150] } })!;
    expect(profile.metric).toBe("pace");
    expect(profile.bars.map((b) => b.value)).toEqual([0, 4]);
    expect(profile.bars[0]!.zone).toBeUndefined();
  });
  it("does not invent recordings or replace missing measurements with zero", () => {
    expect(buildWorkoutProfile(ride, {})).toBeNull();
    expect(buildWorkoutProfile(ride, { time: { data: [0] }, watts: { data: [100] } })).toBeNull();
    const profile = buildWorkoutProfile(ride, { time: { data: [0, 10, 20] }, watts: { data: [0, NaN, 100] } })!;
    expect(profile.bars.map((b) => b.value)).toEqual([0, null]);
  });
  it("keeps all workouts, recorded power, zero load and calculated running pace", () => {
    const sessions = pastSessions(Array.from({ length: 30 }, (_, i) => ({ ...ride, id: String(i), type: "Run", avgSpeedMps: 4, trainingLoad: 0 })));
    expect(sessions).toHaveLength(30);
    expect(sessions[0]).toMatchObject({ id: "0", avgPower: 180, avgPaceSecKm: 250, load: 0, loadEstimated: false });
    expect(pastSessions([{ ...ride, avgSpeedMps: undefined, type: "Run", distanceKm: 12 }])[0]!.avgPaceSecKm).toBe(300);
  });
});
