import { describe, expect, it } from "vitest";
import { buildWeeks, earliestMondayIso, formatPace } from "../src/calendarData.js";
import type { CompletedSession, PlannedSession } from "../src/api.js";

const completed = (date: string, id = date): CompletedSession => ({ id, date, sport: "Run", title: "Run", durationMin: 60, load: 42, loadEstimated: false });
const planned = (date: string): PlannedSession => ({ id: `${date}:Run`, date, sport: "Run", title: "Easy", intensity: "easy", durationMin: 45, rationale: "Easy day" });

describe("calendar weeks", () => {
  it("keeps both planned sports and only removes the sport already completed", () => {
    const plans = [planned("2026-10-28"), { ...planned("2026-10-28"), id: "ride", sport: "Ride" }];
    const now = new Date("2026-10-28T12:00:00");
    const day = (past: CompletedSession[]) => buildWeeks({ past, planned: plans }, now).find((w) => w.label === "This week")!.days[2]!;
    expect(day([]).planned).toHaveLength(2);
    expect(day([completed("2026-10-28")]).planned.map((p) => p.sport)).toEqual(["Ride"]);
  });
  it("orders past, current and future weeks Monday to Sunday, with dates for past headings", () => {
    const weeks = buildWeeks({ past: [completed("2026-10-25"), completed("2026-10-26")], planned: [planned("2026-11-02")] }, new Date("2026-10-28T12:00:00"));
    expect(weeks.map((w) => w.mondayIso)).toEqual(["2026-10-19", "2026-10-26", "2026-11-02"]);
    expect(weeks[0]!.label).toBe(weeks[0]!.range);
    expect(weeks.slice(1).map((w) => w.label)).toEqual(["This week", "Next week"]);
    expect(weeks[0]!.days.at(-1)!.iso).toBe("2026-10-25");
    expect(weeks[1]!.days[0]!.completed).toHaveLength(1);
    expect(weeks.every((w) => w.days[0]!.date.getDay() === 1 && w.days.at(-1)!.date.getDay() === 0)).toBe(true);
  });
  it("totals every workout and keeps planned time separate without duplicating today's completed session", () => {
    const weeks = buildWeeks({ past: [completed("2026-10-28", "a"), completed("2026-10-28", "b")], planned: [planned("2026-10-28"), planned("2026-10-29")] }, new Date("2026-10-28T12:00:00"));
    const current = weeks.find((w) => w.label === "This week")!;
    expect(current.completedMin).toBe(120);
    expect(current.totalLoad).toBe(84);
    expect(current.plannedMin).toBe(45);
    expect(current.days[2]!.planned).toEqual([]);
  });
  it("handles Sunday, year boundaries and an empty account", () => {
    const weeks = buildWeeks({ past: [completed("2026-12-31")], planned: [planned("2027-01-04")] }, new Date("2027-01-03T23:30:00"));
    expect(weeks.find((w) => w.label === "This week")!.mondayIso).toBe("2026-12-28");
    expect(weeks.find((w) => w.label === "This week")!.range).toContain("2026");
    expect(buildWeeks({ past: [], planned: [] })).toEqual([]);
  });
  it("normalizes pace rounding at minute boundaries and missing data", () => {
    expect(formatPace(299.8)).toBe("5:00/km");
    expect(formatPace(undefined)).toBe("—");
    expect(formatPace(Infinity)).toBe("—");
  });
});

describe("calendar paging", () => {
  const now = new Date("2026-10-28T12:00:00");
  const past = Array.from({ length: 40 }, (_, i) => completed(new Date(Date.UTC(2026, 9, 28 - i * 7)).toISOString().slice(0, 10)));
  it("shows only this week and next with no older batch, then adds ten weeks at a time", () => {
    const week = { past, planned: [planned("2026-11-02")] };
    expect(buildWeeks(week, now, 0).map((w) => w.label)).toEqual(["This week", "Next week"]);
    expect(buildWeeks(week, now, 10)).toHaveLength(12);
    expect(buildWeeks(week, now, 20)).toHaveLength(22);
    expect(buildWeeks(week, now, 10)[0]!.mondayIso).toBe("2026-08-17");
  });
  it("stops at the oldest week with data and reports where that is", () => {
    const week = { past: [completed("2026-09-15")], planned: [] };
    expect(earliestMondayIso(week, now)).toBe("2026-09-14");
    expect(buildWeeks(week, now, 50)[0]!.mondayIso).toBe("2026-09-14");
    expect(earliestMondayIso({ past: [], planned: [] }, now)).toBeUndefined();
  });
});
