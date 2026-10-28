import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

const mocks = vi.hoisted(() => ({
  athlete: {} as Record<string, number>, aiPlan: [] as unknown[], saveAiPlan: vi.fn(), completeChat: vi.fn(), streamChat: vi.fn(), fetchProfile: vi.fn(), saveProfile: vi.fn(), saveSchedule: vi.fn(),
  schedule: { timeZone: "Asia/Singapore", days: Array(7).fill(null) },
  activities: [{ id: "old-workout", date: "2026-09-01", type: "Run", name: "Selected workout", durationMin: 45, distanceKm: 9, source: "strava" }],
}));
vi.mock("../src/store.js", () => ({ store: {
  getActivities: () => mocks.activities, getWellness: () => ({ date: "2026-10-28" }), getSource: () => "strava",
  setWorkoutProfile: mocks.saveProfile,
  getTrainingSchedule: () => mocks.schedule,
  setTrainingSchedule: mocks.saveSchedule,
  getAiPlan: () => mocks.aiPlan, setAiPlan: mocks.saveAiPlan,
  getAthlete: () => ({ manual: mocks.athlete, synced: { ftp: 200, weightKg: 70 } }), setAthlete: (v: object) => { mocks.athlete = v; },
} }));
vi.mock("../src/openrouter.js", () => ({ completeChat: mocks.completeChat, streamChat: mocks.streamChat }));
vi.mock("../src/strava.js", () => ({ fetchWorkoutProfile: mocks.fetchProfile, authorizeUrl: vi.fn(), exchangeCode: vi.fn(), syncActivities: vi.fn() }));
vi.mock("../src/config.js", () => ({ config: { webOrigin: "http://localhost" }, hasOpenRouter: () => true, hasStrava: () => false, isFreeModel: () => true }));
import { app } from "../src/index.js";

let server: Server;
let base: string;
beforeAll(async () => {
  server = await new Promise<Server>((resolve) => { const s = app.listen(0, "127.0.0.1", () => resolve(s)); });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
beforeEach(() => {
  mocks.schedule = { timeZone: "Asia/Singapore", days: Array(7).fill(null) };
  mocks.saveSchedule.mockReset().mockImplementation((value) => { mocks.schedule = value; });
  mocks.streamChat.mockReset().mockImplementation(async function* () { yield "## Your plan\n\n- Swim on Monday."; });
  mocks.completeChat.mockReset().mockResolvedValue("A measured effort. Recover with an easy day.");
  mocks.fetchProfile.mockResolvedValue({ metric: "pace", bars: [{ startSec: 0, endSec: 60, value: 3 }] });
});
const review = (body: object) => fetch(`${base}/api/workouts/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

describe("workout API", () => {
  it("loads and caches a workout recording on demand", async () => {
    const a = await fetch(`${base}/api/workouts/old-workout/profile`);
    expect(a.status).toBe(200);
    expect((await a.json()).profile.metric).toBe("pace");
    await fetch(`${base}/api/workouts/old-workout/profile`);
    expect(mocks.fetchProfile).toHaveBeenCalledTimes(1);
    expect(mocks.saveProfile).toHaveBeenCalledWith("old-workout", expect.objectContaining({ metric: "pace" }));
  });
  it("reviews the selected workout retrospectively with its recording and historical context", async () => {
    const response = await review({ activityId: "old-workout" });
    expect(response.status).toBe(200);
    expect((await response.json()).review).toContain("measured effort");
    const messages = mocks.completeChat.mock.calls[0]![0];
    expect(messages[0].content).toContain("retrospectively");
    expect(messages[1].content).toContain('"historicalContext"');
    expect(messages[0].content).not.toContain("Engine readiness:");
    expect(messages[1].content).toContain('"id":"old-workout"');
    expect(messages[1].content).toContain('"metric":"pace"');
  });
  it("saves a standing schedule and injects it into subsequent chats", async () => {
    const schedule = { timeZone: "Asia/Singapore", days: [["Swim"], ["Ride", "Run"], [], null, ["Swim"], ["Ride"], ["Run"]] };
    const saved = await fetch(`${base}/api/training-schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(schedule) });
    expect(saved.status).toBe(200);
    const loaded = await (await fetch(`${base}/api/training-schedule`)).json();
    expect(loaded.saved).toEqual(schedule);
    const response = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Plan my week" }] }) });
    expect(await response.text()).toContain("Your plan");
    const system = mocks.streamChat.mock.calls[0]![0][0].content;
    expect(system).toContain("Monday: Swim [saved]");
    expect(system).toContain("Tuesday: Ride + Run [saved]");
    expect(system).toContain("Wednesday: Rest [saved]");
  });
  it("rejects malformed schedules and reports persistence failures", async () => {
    const post = (body: unknown) => fetch(`${base}/api/training-schedule`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    expect((await post({ timeZone: "Invalid", days: [] })).status).toBe(400);
    expect(mocks.saveSchedule).not.toHaveBeenCalled();
    mocks.saveSchedule.mockImplementationOnce(() => { throw new Error("Disk unavailable"); });
    expect((await post({ timeZone: "Asia/Singapore", days: Array(7).fill(null) })).status).toBe(500);
  });
  it("reviews one planned session by ID when the day has multiple sports", async () => {
    mocks.schedule.days = Array.from({ length: 7 }, () => ["Swim", "Ride"]);
    const week = await (await fetch(`${base}/api/week`)).json();
    const target = week.planned.find((p: { sport: string; intensity: string }) => p.sport === "Ride" && p.intensity !== "rest");
    const response = await review({ plannedId: target.id });
    expect(response.status).toBe(200);
    const messages = mocks.completeChat.mock.calls[0]![0];
    expect(messages[0].content).toContain("PLANNED workout");
    expect(JSON.parse(messages[1].content.split("WORKOUT DATA:\n")[1]).id).toBe(target.id);
  });
  it("rejects unknown workouts without an AI call", async () => {
    expect((await review({ activityId: "missing" })).status).toBe(404);
    expect(mocks.completeChat).not.toHaveBeenCalled();
  });
  it("returns a retryable error on AI failure or an empty response", async () => {
    mocks.completeChat.mockRejectedValueOnce(new Error("Coach unavailable"));
    expect((await review({ activityId: "old-workout" })).status).toBe(502);
    mocks.completeChat.mockResolvedValueOnce("");
    const response = await review({ activityId: "old-workout" });
    expect(response.status).toBe(502);
    expect((await response.json()).error).toContain("empty review");
  });
});

describe("chat calendar sync", () => {
  it("hides the plan block from the reply and saves it to the calendar", async () => {
    mocks.streamChat.mockImplementation(async function* () {
      yield "Done — long ride Saturday.\n<pl"; yield 'an>[{"date":"2099-01-01","sport":"Ride"}]</plan>';
    });
    const response = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "plan" }] }) });
    const text = await response.text();
    expect(text).not.toContain("plan>");
    expect(text).toContain("Done — long ride Saturday.");
    expect(mocks.saveAiPlan).not.toHaveBeenCalled(); // date beyond the 60-day window is rejected
  });
});

it("saves a valid coach plan and confirms it", async () => {
  const { addDateDays, todayInZone } = await import("../src/dates.js");
  const date = addDateDays(todayInZone("Asia/Singapore"), 3);
  mocks.streamChat.mockImplementation(async function* () { yield `Sure.<plan>[{"date":"${date}","sport":"Ride","intensity":"long","durationMin":150}]</plan>`; });
  const response = await fetch(`${base}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeZone: "Asia/Singapore", messages: [{ role: "user", content: "plan" }] }) });
  const text = await response.text();
  expect(text).toBe("Sure.\n\n✓ 1 workout added to your calendar.");
  expect(mocks.saveAiPlan.mock.calls[0]![0][0]).toMatchObject({ date, sport: "Ride", durationMin: 150 });
});

describe("athlete profile", () => {
  const post = (body: object) => fetch(`${base}/api/athlete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  it("falls back to Strava values and lets manual entries win", async () => {
    mocks.athlete = {};
    const before = await (await fetch(`${base}/api/athlete`)).json();
    expect(before.ftp).toEqual({ value: 200, source: "strava" });
    expect(before.thresholdPaceSecKm).toBeNull();
    const after = await (await post({ ftp: 240, thresholdPaceSecKm: 270 })).json();
    expect(after.ftp).toEqual({ value: 240, source: "manual" });
    expect(after.thresholdPaceSecKm).toEqual({ value: 270, source: "manual" });
    expect(after.weightKg).toEqual({ value: 70, source: "strava" });
  });
  it("rejects out-of-range values and clears fields with null", async () => {
    mocks.athlete = { ftp: 240 };
    expect((await post({ ftp: 5000 })).status).toBe(400);
    expect((await post({ weightKg: "heavy" })).status).toBe(400);
    const cleared = await (await post({ ftp: null })).json();
    expect(cleared.ftp).toEqual({ value: 200, source: "strava" });
  });
});
