import { addDateDays, weekdayIndex, WEEKDAYS, validTimeZone } from "./dates.js";
import type { Activity, ScheduleContext, TrainingSchedule, TrainingSport } from "./types.js";

const SPORTS: TrainingSport[] = ["Swim", "Ride", "Run"];
export function trainingSport(type: string): TrainingSport | undefined {
  if (/swim/i.test(type)) return "Swim";
  if (/ride|cycl/i.test(type)) return "Ride";
  if (/run/i.test(type)) return "Run";
  return undefined;
}

export function parseSchedule(value: unknown): TrainingSchedule {
  const input = value as Partial<TrainingSchedule> | null;
  if (!input || !validTimeZone(input.timeZone) || !Array.isArray(input.days) || input.days.length !== 7) {
    throw new Error("Provide a timezone and seven days, Monday to Sunday.");
  }
  const days = input.days.map((day) => {
    if (day === null) return null;
    if (!Array.isArray(day) || day.some((sport) => !SPORTS.includes(sport)) || new Set(day).size !== day.length) {
      throw new Error("Each day must use Swim, Ride and/or Run, an empty list for rest, or null for automatic suggestions.");
    }
    return SPORTS.filter((sport) => day.includes(sport));
  });
  return { timeZone: input.timeZone, days };
}

/** Infer recurring sport days from up to eight completed weeks, never from a single session. */
export function buildSchedule(activities: Activity[], saved: TrainingSchedule, today: string): ScheduleContext {
  const currentMonday = addDateDays(today, -weekdayIndex(today));
  const from = addDateDays(currentMonday, -56);
  const through = addDateDays(currentMonday, -1);
  const history = activities.filter((a) => a.date >= from && a.date <= through && trainingSport(a.type));
  const oldest = history.map((a) => a.date).sort()[0];
  // Empty weeks between recordings count; missing records are not proof of rest days.
  const weeksObserved = oldest ? Math.min(8, Math.ceil((Date.parse(currentMonday) - Date.parse(addDateDays(oldest, -weekdayIndex(oldest)))) / (7 * 86400000))) : 0;
  const days = WEEKDAYS.map((weekday, index) => {
    const evidence: Partial<Record<TrainingSport, number>> = {};
    for (const sport of SPORTS) {
      evidence[sport] = new Set(history.filter((a) => weekdayIndex(a.date) === index && trainingSport(a.type) === sport).map((a) => a.date)).size;
    }
    const explicit = saved.days[index];
    const inferred = SPORTS.filter((sport) => evidence[sport]! >= Math.max(2, Math.ceil(weeksObserved / 2)));
    return {
      weekday, evidence, suggestedSports: inferred,
      sports: explicit ?? inferred,
      source: explicit != null ? "saved" as const : inferred.length ? "inferred" as const : "unknown" as const,
    };
  });
  return { saved, days, weeksObserved, from, through };
}

export function formatSchedule(schedule: ScheduleContext): string {
  return [
    "RECURRING TRAINING WEEK (Monday–Sunday):",
    "Saved days are the athlete's standing preferences. Preserve their sport/day assignments; adjust volume and intensity. Rest/recovery may override a session when needed; explain why. Multiple sports on a day are intentional.",
    `Inferred days are provisional patterns from synced activities, not confirmed commitments (${schedule.weeksObserved} observed calendar weeks, ${schedule.from} through ${schedule.through}). Do not treat missing days as rest.`,
    ...schedule.days.map((day) => `- ${day.weekday}: ${day.source === "unknown" ? "unspecified — no reliable recurring pattern" : day.sports.join(" + ") || "Rest"} [${day.source}]${day.source === "inferred" ? `; ${day.sports.map((sport) => `${sport} on ${day.evidence[sport]}/${schedule.weeksObserved} weeks`).join(", ")}` : ""}`),
    "These are current preferences, not evidence of the athlete's schedule months ago. Temporary instructions in the current conversation may override them for the requested dates; do not claim such changes are saved. Persistent changes are saved in Profile > Training week.",
  ].join("\n");
}
