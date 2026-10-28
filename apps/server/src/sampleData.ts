import type { Activity, Wellness } from "./types.js";

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// A realistic ~4-week block ending today: easy/rest days, a weekly long ride,
// midweek intervals, and a slightly heavier final week (to make form/ACWR interesting).
const WEEK_PATTERN: Array<Omit<Activity, "id" | "date" | "source"> | null> = [
  { type: "Run", name: "Easy run", durationMin: 45, distanceKm: 8, avgHr: 138, maxHr: 165, trainingLoad: 50 },
  { type: "Ride", name: "Intervals", durationMin: 75, distanceKm: 35, avgHr: 150, maxHr: 182, trainingLoad: 110 },
  null, // rest
  { type: "Run", name: "Tempo run", durationMin: 50, distanceKm: 10, avgHr: 156, maxHr: 178, trainingLoad: 85 },
  { type: "Ride", name: "Recovery spin", durationMin: 40, distanceKm: 18, avgHr: 120, maxHr: 140, trainingLoad: 35 },
  { type: "Ride", name: "Long ride", durationMin: 180, distanceKm: 85, avgHr: 142, maxHr: 170, trainingLoad: 210 },
  { type: "Run", name: "Easy run", durationMin: 35, distanceKm: 6, avgHr: 134, maxHr: 158, trainingLoad: 38 },
];

export function sampleActivities(): Activity[] {
  const out: Activity[] = [];
  for (let day = 27; day >= 0; day--) {
    const slot = WEEK_PATTERN[(27 - day) % 7];
    if (!slot) continue;
    // Final week ~20% heavier to create a mild load ramp.
    const ramp = day < 7 ? 1.2 : 1;
    out.push({
      id: `sample-${day}`,
      date: isoDaysAgo(day),
      source: "sample",
      ...slot,
      trainingLoad: slot.trainingLoad ? Math.round(slot.trainingLoad * ramp) : undefined,
    });
  }
  return out;
}

export function sampleWellness(): Wellness {
  return {
    date: isoDaysAgo(0),
    rmssd: 48,
    restingHr: 52,
    sleepHours: 6.5,
    sleepQuality: 3,
    soreness: 3,
    fatigue: 3,
    stress: 3,
    motivation: 4,
  };
}
