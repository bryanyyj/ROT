import { recommend, type ReadinessInput, type ReadinessResult } from "@rot/engine";
import type {
  Activity,
  CompletedSession,
  Intensity,
  PlannedSession,
  Wellness,
} from "./types.js";

/** Rough per-activity training load when the source didn't provide one. */
export function estimateLoad(a: Activity): number {
  if (typeof a.trainingLoad === "number") return a.trainingLoad;
  if (a.avgHr && a.maxHr) {
    const intensity = Math.min(1, Math.max(0.5, a.avgHr / a.maxHr));
    return Math.round(a.durationMin * intensity * 1.5);
  }
  return Math.round(a.durationMin); // moderate default: ~1 load/min
}

/** Chronological daily load series from earliest activity through today (gaps = 0). */
export function dailyLoadSeries(activities: Activity[]): { dates: string[]; loads: number[] } {
  if (activities.length === 0) return { dates: [], loads: [] };
  const byDate = new Map<string, number>();
  for (const a of activities) byDate.set(a.date, (byDate.get(a.date) ?? 0) + estimateLoad(a));

  const sorted = [...activities].sort((x, y) => x.date.localeCompare(y.date));
  const start = new Date(sorted[0]!.date);
  const end = new Date(new Date().toISOString().slice(0, 10));
  const dates: string[] = [];
  const loads: number[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    dates.push(iso);
    loads.push(byDate.get(iso) ?? 0);
  }
  return { dates, loads };
}

export interface CoachContext {
  readiness: ReadinessResult;
  recent: Activity[];
  totalActivities: number;
  weekLoad: number;
}

/** Run the readiness engine over the athlete's real data + any wellness check-in. */
export function buildContext(activities: Activity[], wellness: Wellness): CoachContext {
  const { loads } = dailyLoadSeries(activities);
  const input: ReadinessInput = { sessionLoads: loads };
  if (typeof wellness.rmssd === "number" && wellness.rmssd > 0) {
    input.hrvLnRmssd = Math.log(wellness.rmssd);
  }
  if (typeof wellness.restingHr === "number") input.restingHr = wellness.restingHr;
  input.sleepHours = wellness.sleepHours;
  input.sleepQuality = wellness.sleepQuality as ReadinessInput["sleepQuality"];
  input.soreness = wellness.soreness as ReadinessInput["soreness"];
  input.fatigue = wellness.fatigue as ReadinessInput["fatigue"];
  input.stress = wellness.stress as ReadinessInput["stress"];
  input.motivation = wellness.motivation as ReadinessInput["motivation"];

  const readiness = recommend(input);
  const recent = [...activities].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const weekLoad = loads.slice(-7).reduce((s, l) => s + l, 0);
  return { readiness, recent, totalActivities: activities.length, weekLoad };
}

/** Human-readable data block injected into the model prompt (grounding). */
export function formatContextBlock(ctx: CoachContext): string {
  const r = ctx.readiness;
  const m = r.metrics;
  const lines: string[] = [];
  lines.push(`Today: ${new Date().toISOString().slice(0, 10)}`);
  lines.push(
    `Engine readiness: ${r.recommendation} (score ${r.readinessScore}/100, ${r.confidence} confidence).`,
  );
  lines.push(`Drivers: ${r.drivers.join("; ")}`);
  lines.push(
    `Training load — CTL/fitness ${m.ctl.toFixed(0)}, ATL/fatigue ${m.atl.toFixed(0)}, ` +
      `TSB/form ${m.tsb.toFixed(0)}${m.acwr !== undefined ? `, ACWR ${m.acwr.toFixed(2)}` : ""}.`,
  );
  lines.push(`Last 7 days total load: ${ctx.weekLoad}.`);
  lines.push(`Recent activities (most recent first):`);
  for (const a of ctx.recent) {
    const hr = a.avgHr ? `, ${a.avgHr}bpm avg` : "";
    const dist = a.distanceKm ? `, ${a.distanceKm.toFixed(1)}km` : "";
    lines.push(
      `- ${a.date} ${a.type}${a.name ? ` "${a.name}"` : ""}: ${a.durationMin}min${dist}${hr}, load ${estimateLoad(a)}`,
    );
  }
  return lines.join("\n");
}

export const COACH_SYSTEM = `You are an experienced, pragmatic endurance coach for cyclists, runners and triathletes.
You advise one athlete on whether to train hard, train easy, or rest, and you plan/adjust their week.

Rules:
- Ground every recommendation in the ATHLETE DATA block below. Do not invent numbers or workouts the data doesn't support.
- The data block includes a readiness engine's verdict (CTL/ATL/TSB form, ACWR, HRV/sleep signals). Treat the engine's REST/TRAIN verdict as a strong prior; you may nuance it but explain any disagreement.
- Be concise and specific: give sessions with duration and intensity, not vague advice.
- If key recovery data (HRV/sleep) is missing, say so and reason from training load/form instead.
- Never give medical advice; if signals suggest illness or injury, advise caution and professional input.`;

export function contextMessage(ctx: CoachContext): string {
  return `ATHLETE DATA:\n${formatContextBlock(ctx)}`;
}

// ---- Structured weekly plan (deterministic, engine-grounded) ----

const INTENSITY_MIN: Record<Intensity, number> = {
  rest: 0,
  easy: 45,
  tempo: 60,
  threshold: 75,
  vo2: 60,
  long: 150,
};

const INTENSITY_RATIONALE: Record<Intensity, string> = {
  rest: "Recovery day — let fitness absorb.",
  easy: "Aerobic base, keep it conversational.",
  tempo: "Sustained moderate effort.",
  threshold: "Work at/near threshold to lift fitness.",
  vo2: "Short hard intervals for top-end.",
  long: "Long endurance session for aerobic volume.",
};

function dominantSport(activities: Activity[]): string {
  const counts = new Map<string, number>();
  for (const a of activities) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  let best = "Ride";
  let max = 0;
  for (const [sport, n] of counts) if (n > max) ((max = n), (best = sport));
  return best;
}

function isoPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 7-day microcycle from today, shaped by the engine verdict and ACWR. */
export function planWeek(ctx: CoachContext, activities: Activity[]): PlannedSession[] {
  const sport = dominantSport(activities);
  const acwr = ctx.readiness.metrics.acwr ?? 1;
  const deload = acwr >= 1.3 || ctx.readiness.recommendation === "REST";

  const template: Intensity[] = deload
    ? ["easy", "rest", "easy", "tempo", "rest", "long", "easy"]
    : ["threshold", "easy", "rest", "tempo", "easy", "long", "easy"];

  // Today is driven by the engine's live verdict.
  template[0] =
    ctx.readiness.recommendation === "REST"
      ? "rest"
      : ctx.readiness.recommendation === "TRAIN_EASY"
        ? "easy"
        : template[0]!;

  return template.map((intensity, i) => {
    const title =
      intensity === "rest"
        ? "Rest"
        : `${intensity[0]!.toUpperCase()}${intensity.slice(1)} ${sport.toLowerCase()}`;
    const rationale =
      i === 0 && intensity !== "rest"
        ? `${INTENSITY_RATIONALE[intensity]} (engine: ${ctx.readiness.recommendation}).`
        : i === 0
          ? `${INTENSITY_RATIONALE[intensity]} (engine says rest today).`
          : INTENSITY_RATIONALE[intensity];
    return {
      date: isoPlus(i),
      sport: intensity === "rest" ? sport : sport,
      title,
      intensity,
      durationMin: INTENSITY_MIN[intensity],
      rationale,
    };
  });
}

/** Recent completed sessions for the calendar (most recent first). */
export function pastSessions(activities: Activity[], limit = 21): CompletedSession[] {
  return [...activities]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((a) => {
      const s: CompletedSession = {
        date: a.date,
        sport: a.type,
        title: a.name ?? a.type,
        durationMin: a.durationMin,
        load: estimateLoad(a),
      };
      if (a.distanceKm !== undefined) s.distanceKm = a.distanceKm;
      return s;
    });
}

export const WEEKLY_PLAN_PROMPT = `Using the athlete data, produce a 7-day training plan starting today.
For each day give: day/date, session type, duration, intensity (easy/tempo/threshold/VO2/rest), and a one-line rationale.
Start with a 2-sentence summary of the athlete's current form and what this week targets. Keep total load sensible vs. their recent load and ACWR.`;
