import type { CompletedSession, PlannedSession, WeekData } from "./api.js";

const pad = (n: number) => String(n).padStart(2, "0");
export const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const addDays = (d: Date, n: number) => {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
};
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7));

export interface DayCell {
  iso: string;
  date: Date;
  completed: CompletedSession[];
  planned: PlannedSession[];
}
export interface WeekGroup {
  mondayIso: string;
  label: string;
  range: string;
  totalLoad: number;
  completedMin: number;
  plannedMin: number;
  hasCompleted: boolean;
  open: boolean;
  days: DayCell[];
}

/** Monday of the oldest week the calendar can show (never later than last week). */
export function earliestMondayIso(week: Pick<WeekData, "past" | "planned">, now = new Date()): string | undefined {
  const dates = [...week.past, ...week.planned].map((s) => s.date).sort();
  if (!dates.length) return undefined;
  const previousIso = localIso(addDays(mondayOf(parse(localIso(now))), -7));
  return localIso(mondayOf(parse(dates[0]! < previousIso ? dates[0]! : previousIso)));
}

/** `weeksBack` limits how many weeks before the current one are included (all of them by default). */
export function buildWeeks(week: Pick<WeekData, "past" | "planned">, now = new Date(), weeksBack = Infinity): WeekGroup[] {
  const completedBy = new Map<string, CompletedSession[]>();
  for (const c of week.past) completedBy.set(c.date, [...(completedBy.get(c.date) ?? []), c]);
  const plannedBy = new Map<string, PlannedSession[]>();
  for (const p of week.planned) plannedBy.set(p.date, [...(plannedBy.get(p.date) ?? []), p]);
  const all = [...completedBy.keys(), ...plannedBy.keys()].sort();
  if (!all.length) return [];
  const today = localIso(now);
  const current = mondayOf(parse(today));
  const next = addDays(current, 7);
  const previousIso = localIso(addDays(current, -7));
  const nextIso = localIso(next);
  const oldest = mondayOf(parse(all[0]! < previousIso ? all[0]! : previousIso));
  const limit = Number.isFinite(weeksBack) ? addDays(current, -7 * weeksBack) : oldest;
  const first = oldest > limit ? oldest : limit;
  const last = mondayOf(parse(all[all.length - 1]! > nextIso ? all[all.length - 1]! : nextIso));
  const weeks: WeekGroup[] = [];
  for (let monday = first; monday <= last; monday = addDays(monday, 7)) {
    const mondayIso = localIso(monday);
    const days = Array.from({ length: 7 }, (_, i): DayCell => {
      const date = addDays(monday, i);
      const iso = localIso(date);
      const completed = completedBy.get(iso) ?? [];
      const sportKey = (sport: string) => /swim/i.test(sport) ? "Swim" : /ride|cycl/i.test(sport) ? "Ride" : /run/i.test(sport) ? "Run" : sport;
      const planned = iso >= today ? (plannedBy.get(iso) ?? []).filter((p) =>
        p.intensity === "rest" ? !completed.length : !completed.some((c) => sportKey(c.sport) === sportKey(p.sport))) : [];
      return { iso, date, completed, planned };
    });
    const completed = days.flatMap((day) => day.completed);
    const sunday = addDays(monday, 6);
    const dateOptions: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", ...(monday.getFullYear() !== now.getFullYear() || sunday.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}) };
    const range = `${monday.toLocaleDateString(undefined, dateOptions)} – ${sunday.toLocaleDateString(undefined, dateOptions)}`;
    weeks.push({
      mondayIso, range,
      label: mondayIso === localIso(current) ? "This week" : mondayIso === localIso(next) ? "Next week" : range,
      totalLoad: completed.reduce((sum, c) => sum + c.load, 0),
      completedMin: completed.reduce((sum, c) => sum + c.durationMin, 0),
      plannedMin: days.reduce((sum, day) => sum + day.planned.reduce((total, p) => total + p.durationMin, 0), 0),
      hasCompleted: completed.length > 0,
      open: mondayIso === localIso(current),
      days,
    });
  }
  return weeks; // Monday–Sunday weeks, past above future.
}

export function formatPace(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${pad(rounded % 60)}/km`;
}

export function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}h ${rounded % 60}m` : `${rounded} min`;
}
