import { CONFIG, recommend, type ReadinessInput, type ReadinessResult } from "@rot/engine";
import type {
  Activity,
  CompletedSession,
  Intensity,
  PlannedSession,
  Wellness,
  ScheduleContext,
} from "./types.js";
import { addDateDays, datedWeekday, todayInZone, weekdayIndex } from "./dates.js";
import { formatSchedule, trainingSport } from "./schedule.js";
import { volumeBaseline } from "./planning.js";

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
export function dailyLoadSeries(activities: Activity[], asOf = todayInZone()): { dates: string[]; loads: number[] } {
  activities = activities.filter((a) => a.date <= asOf);
  if (activities.length === 0) return { dates: [], loads: [] };
  const byDate = new Map<string, number>();
  for (const a of activities) byDate.set(a.date, (byDate.get(a.date) ?? 0) + estimateLoad(a));

  const sorted = [...activities].sort((x, y) => x.date.localeCompare(y.date));
  const start = new Date(sorted[0]!.date);
  const end = new Date(asOf);
  const dates: string[] = [];
  const loads: number[] = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    dates.push(iso);
    loads.push(byDate.get(iso) ?? 0);
  }
  return { dates, loads };
}

/** Days of ramp-up skipped so the EWMA seed (zero) doesn't masquerade as fatigue. */
const FORM_WARMUP_DAYS = 14;

/** Daily Form (TSB = CTL − ATL) using the same maths as the readiness engine, for the status chart. */
export function formHistory(activities: Activity[], asOf = todayInZone()): { date: string; tsb: number }[] {
  const { dates, loads } = dailyLoadSeries(activities, asOf);
  let ctl = 0;
  let atl = 0;
  const points = dates.map((date, i) => {
    ctl += (loads[i]! - ctl) / CONFIG.loadTau.ctl;
    atl += (loads[i]! - atl) / CONFIG.loadTau.atl;
    return { date, tsb: Math.round((ctl - atl) * 10) / 10 };
  });
  return points.slice(FORM_WARMUP_DAYS).slice(-366);
}

export interface CoachContext {
  date: string;
  readiness: ReadinessResult;
  recent: Activity[];
  totalActivities: number;
  weekLoad: number;
  schedule?: ScheduleContext;
  wellnessAvailable: boolean;
}

/** Run the readiness engine over the athlete's real data + any wellness check-in. */
export function buildContext(activities: Activity[], wellness: Wellness, asOf = todayInZone(), schedule?: ScheduleContext): CoachContext {
  activities = activities.filter((a) => a.date <= asOf);
  const wellnessAvailable = wellness.date === asOf && Object.entries(wellness).some(([key, value]) => key !== "date" && typeof value === "number");
  if (wellness.date !== asOf) wellness = { date: asOf };
  const { loads } = dailyLoadSeries(activities, asOf);
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
  return { date: asOf, readiness, recent, totalActivities: activities.length, weekLoad, schedule, wellnessAvailable };
}

/** Human-readable data block injected into the model prompt (grounding). */
export function formatContextBlock(ctx: CoachContext): string {
  const r = ctx.readiness;
  const m = r.metrics;
  const lines: string[] = [];
  lines.push(`Assessment date: ${datedWeekday(ctx.date)}. All readiness metrics below apply to this date only.`);
  if (!ctx.wellnessAvailable) lines.push("No same-day wellness check-in available; old check-ins have been excluded.");
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
      `- ${datedWeekday(a.date)} ${trainingSport(a.type) ?? a.type}${a.name ? ` "${a.name}"` : ""}: ${Math.round(a.durationMin)}min${dist}${hr}, load ${estimateLoad(a)}`,
    );
  }
  if (ctx.schedule) lines.push("", formatSchedule(ctx.schedule));
  lines.push("", "DATE REFERENCE — use these exact weekday/date pairs when planning:");
  for (let i = 0; i < 14; i++) {
    const date = addDateDays(ctx.date, i);
    const day = ctx.schedule?.days[weekdayIndex(date)];
    lines.push(`${datedWeekday(date)}${day ? ` — ${day.source === "unknown" ? "sports unspecified" : day.sports.join(" + ") || "Rest"} (${day.source})` : ""}`);
  }
  return lines.join("\n");
}

export const COACH_SYSTEM = `You are an experienced, pragmatic endurance coach for cyclists, runners and triathletes.
You advise one athlete on whether to train hard, train easy, or rest, and you plan/adjust their week.

Rules:
- Ground every recommendation in the ATHLETE DATA block below. Do not invent numbers or workouts the data doesn't support.
- The data block includes a readiness engine's verdict (CTL/ATL/TSB form, ACWR, HRV/sleep signals). Treat the engine's REST/TRAIN verdict as a strong prior; you may nuance it but explain any disagreement.
- Be concise and specific: give sessions with duration and intensity, not vague advice.
- Respect the recurring training week: keep cycling, running and swimming on their assigned days, including multiple sports. Adjust intensity/duration first; explain any necessary recovery override. Inferred days are provisional, saved days are standing preferences.
- For historical workouts, use past tense and dated evidence only. Never apply current readiness to an old workout or prescribe tomorrow's recovery in a retrospective review. If historical context is missing, say so.
- Use the supplied weekday/date reference exactly. Never guess the weekday of a date.
- Format responses in readable Markdown: short headings, brief paragraphs and bullets; bold only key values or session labels. For plans use dated day headings and one bullet per sport with duration, intensity and reason. Avoid dense tables and long preambles.
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
  for (const a of activities) {
    const sport = trainingSport(a.type) ?? a.type;
    counts.set(sport, (counts.get(sport) ?? 0) + 1);
  }
  let best = "Ride";
  let max = 0;
  for (const [sport, n] of counts) if (n > max) ((max = n), (best = sport));
  return best;
}

/** 7-day microcycle from today, shaped by the engine verdict and ACWR. */
export function planWeek(ctx: CoachContext, activities: Activity[]): PlannedSession[] {
  const sport = dominantSport(activities);
  const volume = volumeBaseline(activities, ctx.date);
  const volumeFactor = volume.mode === "deload" ? 0.72 : volume.mode === "build" ? 1.05 : 1;
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

  return template.flatMap<PlannedSession>((templateIntensity, i) => {
    const date = addDateDays(ctx.date, i);
    const day = ctx.schedule?.days[weekdayIndex(date)];
    const fixedRest = day?.source === "saved" && day.sports.length === 0;
    const sports = day?.sports.length ? day.sports : [sport];
    const intensity = fixedRest ? "rest" : i > 0 && day?.sports.length && templateIntensity === "rest" ? "easy" : templateIntensity;
    if (intensity === "rest") return [{
      id: `${date}:rest`, date, sport: sports.join(" + "), title: "Rest", intensity, durationMin: 0,
      rationale: fixedRest ? "Your regular rest day." : i === 0 ? "Recovery day — the engine recommends rest today." : INTENSITY_RATIONALE.rest,
    }];
    return sports.map((sessionSport) => {
      const title = `${intensity[0]!.toUpperCase()}${intensity.slice(1)} ${sessionSport.toLowerCase()}`;
      const rationale = i === 0
        ? `${INTENSITY_RATIONALE[intensity]} (engine: ${ctx.readiness.recommendation}).`
        : INTENSITY_RATIONALE[intensity];
      // Keep each day near its typical volume instead of a fixed template length.
      const sessionMinutes = () => {
        const typical = volume.typical.find((t) => t.weekday === weekdayIndex(date) && t.sport === sessionSport)?.minutes ?? volume.sportMedian[sessionSport as keyof typeof volume.sportMedian];
        if (!typical) return Math.round(Math.min(INTENSITY_MIN[intensity], sessionSport === "Swim" ? 60 : sessionSport === "Run" ? 90 : 180) / sports.length);
        const base = intensity === "long" ? Math.max(typical, (volume.sportMedian[sessionSport as keyof typeof volume.sportMedian] ?? typical) * 1.3) : typical;
        return Math.max(20, Math.round(base * volumeFactor / 5) * 5);
      };
      return {
        id: `${date}:${sessionSport}`, date, sport: sessionSport, title, intensity,
        durationMin: sessionMinutes(),
        rationale: `${rationale} ${day?.source === "saved" ? "On your saved training day." : day?.source === "inferred" ? "Sport suggested from your recent weekly pattern." : "Sport is provisional; set your training days in Profile."}`,
      };
    });
  });
}

/** Recent completed sessions for the calendar (most recent first). */
export function pastSessions(activities: Activity[]): CompletedSession[] {
  return [...activities]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((a) => {
      const s: CompletedSession = {
        id: a.id,
        date: a.date,
        sport: a.type,
        title: a.name ?? a.type,
        durationMin: a.durationMin,
        load: estimateLoad(a),
        loadEstimated: a.trainingLoad === undefined,
        avgPower: a.avgPower,
        avgHr: a.avgHr,
        powerEstimated: a.powerEstimated,
        avgPaceSecKm: /run/i.test(a.type)
          ? a.avgSpeedMps && a.avgSpeedMps > 0 ? 1000 / a.avgSpeedMps
            : a.distanceKm && a.distanceKm > 0 ? a.durationMin * 60 / a.distanceKm : undefined
          : undefined,
      };
      if (a.distanceKm !== undefined) s.distanceKm = a.distanceKm;
      return s;
    });
}

export const WEEKLY_PLAN_PROMPT = `Using the athlete data, produce a 7-day training plan starting today.
For each day give: day/date, session type, duration, intensity (easy/tempo/threshold/VO2/rest), and a one-line rationale.
Keep each sport on its saved or inferred weekday, including multi-sport days. Use the supplied date reference. Explicitly label any assumptions for unspecified days.
Start with a 2-sentence summary of the athlete's current form and what this week targets. Keep total load sensible vs. their recent load and ACWR.`;
