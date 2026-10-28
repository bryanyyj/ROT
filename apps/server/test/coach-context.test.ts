import { describe, expect, it } from "vitest";
import { completedReviewMessages } from "../src/review.js";
import { buildContext, formatContextBlock, planWeek } from "../src/coach.js";
import { buildSchedule, parseSchedule } from "../src/schedule.js";
import { addDateDays, todayInZone, weekdayIndex } from "../src/dates.js";
import type { Activity, TrainingSchedule } from "../src/types.js";

const activity = (date: string, type = "Run", id = `${date}:${type}`): Activity => ({ id, date, type, durationMin: 60, trainingLoad: 50, source: "import" });
const automatic: TrainingSchedule = { timeZone: "Asia/Singapore", days: Array(7).fill(null) };

describe("historical review grounding", () => {
  it("uses history before a six-month-old workout and excludes today's metrics and later activities", () => {
    const selected = activity("2026-04-28");
    const preceding = [activity("2026-04-01"), activity("2026-04-27")];
    const later = { ...activity("2026-10-28"), name: "TODAY_ONLY", trainingLoad: 9999 };
    const messages = completedReviewMessages(selected, [...preceding, selected, later], null, "2026-10-28");
    const data = JSON.parse(messages[1]!.content.split("WORKOUT DATA:\n")[1]!);
    expect(data.workoutDate).toBe("Tuesday 2026-04-28");
    expect(data.reviewedOn).toBe("Wednesday 2026-10-28");
    expect(data.daysSinceWorkout).toBe(183);
    expect(data.historicalContext.through).toBe("2026-04-27");
    expect(data.historicalContext.loadEstimates.preceding7DayLoad).toBe(50);
    expect(messages[1]!.content).not.toContain("TODAY_ONLY");
    expect(messages[1]!.content).not.toContain("recommendation");
    expect(messages[1]!.content).not.toContain("readinessScore");
    expect(messages[0]!.content).toContain("Do not pretend this session is upcoming");
    expect(messages).toEqual(completedReviewMessages(selected, [...preceding, selected], null, "2026-10-28"));
  });
  it("does not invent historical fitness when preceding data is missing", () => {
    const selected = activity("2026-04-28");
    const messages = completedReviewMessages(selected, [selected, activity("2026-10-28")], null, "2026-10-28");
    const data = JSON.parse(messages[1]!.content.split("WORKOUT DATA:\n")[1]!);
    expect(data.historicalContext.loadEstimates).toBeNull();
    expect(data.historicalContext.availableHistoryDays).toBe(0);
  });
  it("ignores stale wellness and supplies correct local weekday/date pairs", () => {
    const activities = [activity("2026-10-27")];
    const stale = buildContext(activities, { date: "2026-04-28", sleepHours: 1 }, "2026-10-28");
    const empty = buildContext(activities, { date: "2026-10-28" }, "2026-10-28");
    expect(stale.readiness).toEqual(empty.readiness);
    expect(formatContextBlock(stale)).toContain("Thursday 2026-10-29");
    expect(formatContextBlock(stale)).toContain("Monday 2026-11-02");
    expect(todayInZone("Asia/Singapore", new Date("2026-10-28T18:00:00Z"))).toBe("2026-10-29");
  });
});

describe("recurring training week", () => {
  const history = Array.from({ length: 8 }, (_, i) => {
    const monday = addDateDays("2026-10-19", -i * 7);
    return [activity(monday, "Swim"), activity(monday, "Swim", `second-${i}`), activity(addDateDays(monday, 1), "VirtualRide"), activity(addDateDays(monday, 1), "TrailRun")];
  }).flat();
  it("recognises multi-sport days without counting doubles twice or one-offs as habits", () => {
    const schedule = buildSchedule([...history, activity("2026-10-22", "Swim")], automatic, "2026-10-28");
    expect(schedule.weeksObserved).toBe(8);
    expect(schedule.days[0]!.sports).toEqual(["Swim"]);
    expect(schedule.days[0]!.evidence.Swim).toBe(8);
    expect(schedule.days[1]!.sports).toEqual(["Ride", "Run"]);
    expect(schedule.days[3]!.source).toBe("unknown");
    expect(schedule.days[3]!.sports).toEqual([]);
  });
  it("saved sport/rest days override history, while Auto keeps its suggestions", () => {
    const saved = parseSchedule({ ...automatic, days: [["Run"], [], null, null, null, null, null] });
    const context = buildSchedule(history, saved, "2026-10-28");
    expect(context.days[0]).toMatchObject({ sports: ["Run"], suggestedSports: ["Swim"], source: "saved" });
    expect(context.days[1]).toMatchObject({ sports: [], source: "saved" });
    expect(() => parseSchedule({ ...automatic, days: [["Football"], ...Array(6).fill(null)] })).toThrow();
    expect(() => parseSchedule({ ...automatic, days: [["Run", "Run"], ...Array(6).fill(null)] })).toThrow();
  });
  it("calendar planning respects saved weekdays and preserves both sports on doubles", () => {
    const saved = parseSchedule({ ...automatic, days: [["Swim"], ["Ride", "Run"], ["Swim"], ["Ride"], [], ["Ride"], ["Run"]] });
    const schedule = buildSchedule(history, saved, "2026-10-28");
    const ctx = buildContext(history, { date: "2026-10-28" }, "2026-10-28", schedule);
    const plan = planWeek(ctx, history);
    expect(plan.filter((p) => p.date === "2026-11-03").map((p) => p.sport)).toEqual(["Ride", "Run"]);
    expect(plan.find((p) => p.date === "2026-10-30")!.intensity).toBe("rest");
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
    for (const session of plan.filter((p) => p.intensity !== "rest")) expect(saved.days[weekdayIndex(session.date)]).toContain(session.sport);
  });
});
