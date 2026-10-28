import type { Activity, TrainingSport } from "./types.js";
import { addDateDays, WEEKDAYS, weekdayIndex } from "./dates.js";
import { trainingSport } from "./schedule.js";

/**
 * Condensed from standard endurance-coaching practice: progressive overload with 3:1 loading/deload
 * blocks (Friel, Triathlete's Training Bible), polarized ~80/20 intensity distribution (Seiler 2010),
 * pace/power zone workouts (Daniels' Running Formula, Coggan power zones).
 * Injected only on planning requests to keep token use low.
 */
export const PLAN_PRINCIPLES = `PLANNING RULES (follow strictly):
- VOLUME: compare with the VOLUME BASELINE block. A loading week must be ≥ last week's minutes (aim +3–10%, never below). Only a DELOAD week (-25–30%, keep a little intensity) may be lower; use it when the baseline says deload, the engine says REST, or ACWR ≥ 1.3. After a deload return to the previous peak.
- PER DAY: keep each day's sport and duration close to that weekday's typical session in the baseline. Don't shrink sessions to fit a rest-heavy week; build volume by lengthening the long session first, then the easy ones.
- Every sport assigned to a weekday in the training week must appear on that day.
- INTENSITY: ~80% easy, ~20% hard. 1–2 quality sessions per sport per week (max 3 hard days overall), never on consecutive days, easy day after each hard day. One long session per week (ride ≈25–30% of weekly time).
- VARIETY: rotate the quality session type week to week; don't repeat last week's. Progress reps/duration over the block.
  Run: strides/hill sprints, VO2 5×3min @ 5k effort, threshold 3×10min, tempo 20–30min, fartlek, progression long run.
  Ride: sweet spot 3×15min, threshold 2×20min, VO2 5×4min, over-unders, 8×15s sprints, tempo blocks.
  Swim: CSS 8×100, fast 10×50, pyramid, technique drills + endurance continuous.
- Put the structure in "title" (e.g. "Threshold 3×10min"); durationMin includes warm-up/cool-down; "note" gives the one-line purpose. Use "easy" for aerobic, "long" for the long session.`;

const PLAN_WORDS = /\b(plan|schedule|program|reschedule|workouts?|sessions?|training (week|block)|week|build|deload|taper|harder|easier|longer|shorter|swap|move|adjust|change|volume|intervals?|speed)\b/i;
export const isPlanRequest = (text: string) => PLAN_WORDS.test(text);

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export interface VolumeBaseline {
  /** Completed Monday–Sunday weeks, oldest first, minutes. */
  weeks: number[];
  mode: "build" | "deload" | "unknown";
  targetMin: number;
  /** Typical session minutes by weekday index (0 = Monday) and sport. */
  typical: { weekday: number; sport: TrainingSport; minutes: number }[];
  sportMedian: Partial<Record<TrainingSport, number>>;
}

/** Real volume history over up to the last four completed weeks (+ typical sessions over eight). */
export function volumeBaseline(activities: Activity[], today: string, forceDeload = false): VolumeBaseline {
  const monday = addDateDays(today, -weekdayIndex(today));
  const sessions = activities.filter((a) => trainingSport(a.type) && a.date < monday && a.date >= addDateDays(monday, -56));
  const weeks = [3, 2, 1, 0].map((back) => {
    const start = addDateDays(monday, -7 * (back + 1));
    const end = addDateDays(start, 7);
    return Math.round(sessions.filter((a) => a.date >= start && a.date < end).reduce((sum, a) => sum + a.durationMin, 0));
  });
  const active = weeks.filter((w) => w > 0);
  const last = weeks[3]!;
  const peak = Math.max(...weeks);
  let mode: VolumeBaseline["mode"] = "unknown";
  let targetMin = 0;
  if (active.length) {
    const loadingStreak = weeks[1]! >= weeks[0]! * 0.97 && weeks[2]! >= weeks[1]! * 0.97 && weeks[3]! >= weeks[2]! * 0.97 && weeks[0]! > 0;
    if (forceDeload || loadingStreak) { mode = "deload"; targetMin = Math.round(last * 0.72); }
    else {
      mode = "build";
      // After a down week, return to the recent peak; otherwise progress ~5%.
      targetMin = Math.round(last < peak * 0.85 ? peak : Math.max(last, median(active)) * 1.05);
    }
  }
  const typical: VolumeBaseline["typical"] = [];
  const sportMedian: VolumeBaseline["sportMedian"] = {};
  for (const sport of ["Swim", "Ride", "Run"] as const) {
    const own = sessions.filter((a) => trainingSport(a.type) === sport);
    if (own.length) sportMedian[sport] = Math.round(median(own.map((a) => a.durationMin)));
    for (let weekday = 0; weekday < 7; weekday++) {
      const onDay = own.filter((a) => weekdayIndex(a.date) === weekday).map((a) => a.durationMin);
      if (onDay.length) typical.push({ weekday, sport, minutes: Math.round(median(onDay)) });
    }
  }
  return { weeks, mode, targetMin, typical, sportMedian };
}

export function formatVolume(v: VolumeBaseline): string {
  if (v.mode === "unknown") return "VOLUME BASELINE: no completed weeks in the last 8 — start conservatively and say so.";
  const lines = [
    `VOLUME BASELINE (training minutes, last 4 completed weeks, oldest→newest): ${v.weeks.join(", ")}.`,
    v.mode === "deload"
      ? `This coming week should be a DELOAD: about ${v.targetMin} min total.`
      : `This coming week should BUILD: about ${v.targetMin} min total (never below ${v.weeks[3]} unless asked for rest).`,
    `Typical sessions by day: ${v.typical.map((t) => `${WEEKDAYS[t.weekday]!.slice(0, 3)} ${t.sport} ${t.minutes}min`).join("; ") || "none"}.`,
    `Typical length per sport: ${Object.entries(v.sportMedian).map(([s, m]) => `${s} ${m}min`).join(", ")}.`,
  ];
  return lines.join("\n");
}
