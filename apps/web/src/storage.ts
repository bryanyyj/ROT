import type { Likert, ReadinessInput } from "@rot/engine";

/** A single day's check-in, keyed by ISO date (YYYY-MM-DD). */
export interface DailyEntry {
  date: string;
  /** HRV as rMSSD in ms (converted to ln internally). */
  rmssd?: number;
  restingHr?: number;
  sleepHours?: number;
  sleepQuality?: Likert;
  soreness?: Likert;
  fatigue?: Likert;
  stress?: Likert;
  motivation?: Likert;
  /** Training load for the day (TSS/TRIMP units). */
  sessionLoad?: number;
}

const KEY = "rot.entries.v1";

export function loadEntries(): DailyEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyEntry[];
    return parsed.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

export function saveEntry(entry: DailyEntry): DailyEntry[] {
  const entries = loadEntries().filter((e) => e.date !== entry.date);
  entries.push(entry);
  entries.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(KEY, JSON.stringify(entries));
  return entries;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build the engine input for `entry`, using all earlier entries as history.
 * rMSSD is ln-transformed for the engine. [EV-005]
 */
export function toEngineInput(entry: DailyEntry, allEntries: DailyEntry[]): ReadinessInput {
  const history = allEntries.filter((e) => e.date < entry.date);

  const hrvHistory = history
    .map((e) => e.rmssd)
    .filter((v): v is number => typeof v === "number" && v > 0)
    .map((v) => Math.log(v))
    .slice(-60);

  const rhrHistory = history
    .map((e) => e.restingHr)
    .filter((v): v is number => typeof v === "number")
    .slice(-60);

  // Chronological daily loads including today's (missing days count as 0 rest).
  const sessionLoads = [...history, entry]
    .map((e) => e.sessionLoad ?? 0)
    .slice(-56);

  const input: ReadinessInput = {
    sleepHours: entry.sleepHours,
    sleepQuality: entry.sleepQuality,
    soreness: entry.soreness,
    fatigue: entry.fatigue,
    stress: entry.stress,
    motivation: entry.motivation,
    hrvHistory,
    rhrHistory,
    sessionLoads,
  };
  if (typeof entry.rmssd === "number" && entry.rmssd > 0) input.hrvLnRmssd = Math.log(entry.rmssd);
  if (typeof entry.restingHr === "number") input.restingHr = entry.restingHr;
  return input;
}
