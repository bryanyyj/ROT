import { beforeEach, describe, expect, it, vi } from "vitest";

const disk = vi.hoisted(() => ({ value: JSON.stringify({ source: "none", activities: [] }), fail: false }));
vi.mock("node:fs", () => ({
  readFileSync: () => disk.value,
  mkdirSync: vi.fn(),
  writeFileSync: (_path: string, value: string) => { if (disk.fail) throw new Error("Disk full"); disk.value = value; },
}));

beforeEach(() => {
  disk.value = JSON.stringify({ source: "none", activities: [] });
  disk.fail = false;
  vi.resetModules();
});

describe("persistent training preferences", () => {
  it("survives reloads and syncing activities without losing multiple-sport days", async () => {
    const { store } = await import("../src/store.js");
    const schedule = { timeZone: "Asia/Singapore", days: [["Swim" as const], ["Ride" as const, "Run" as const], [], null, null, null, null] };
    store.setTrainingSchedule(schedule);
    store.setActivities([{ id: "synced", date: "2026-10-28", type: "Run", durationMin: 30, source: "strava" }], "strava");
    vi.resetModules();
    const reloaded = (await import("../src/store.js")).store;
    expect(reloaded.getTrainingSchedule()).toEqual(schedule);
    expect(reloaded.getActivities()).toHaveLength(1);
  });
  it("keeps the previous schedule if writing fails", async () => {
    const { store } = await import("../src/store.js");
    const original = store.getTrainingSchedule();
    disk.fail = true;
    expect(() => store.setTrainingSchedule({ timeZone: "UTC", days: Array.from({ length: 7 }, () => []) })).toThrow("Disk full");
    expect(store.getTrainingSchedule()).toEqual(original);
  });
});
