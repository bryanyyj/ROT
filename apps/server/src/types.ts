export type DataSource = "strava" | "garmin" | "intervals" | "import" | "none";

/** A single training activity, normalised across sources. */
export interface Activity {
  id: string;
  date: string; // YYYY-MM-DD (local)
  type: string; // Run | Ride | Swim | ...
  name?: string;
  durationMin: number;
  distanceKm?: number;
  avgPower?: number;
  avgSpeedMps?: number;
  powerEstimated?: boolean;
  profile?: WorkoutProfile;
  avgHr?: number;
  maxHr?: number;
  /** Training load for the activity (TSS / TRIMP / Strava relative effort). */
  trainingLoad?: number;
  source: DataSource;
}

/** Optional daily recovery/wellness (from manual check-in or Garmin). */
export interface Wellness {
  date: string;
  rmssd?: number; // HRV rMSSD (ms)
  restingHr?: number;
  sleepHours?: number;
  sleepQuality?: number;
  soreness?: number;
  fatigue?: number;
  stress?: number;
  motivation?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type Intensity = "rest" | "easy" | "tempo" | "threshold" | "vo2" | "long";

/** A planned (future) training session on the calendar. */
export interface PlannedSession {
  id: string;
  date: string; // YYYY-MM-DD
  sport: string; // Ride | Run | Swim
  title: string;
  intensity: Intensity;
  durationMin: number;
  rationale: string;
}

/** Athlete benchmarks. Manual entries win over values synced from Strava. */
export interface AthleteProfile {
  ftp?: number; // watts
  thresholdPaceSecKm?: number;
  weightKg?: number;
}

export type TrainingSport = "Swim" | "Ride" | "Run";

export interface TrainingSchedule {
  timeZone: string;
  /** Monday first. null = infer from history; [] = explicitly rest; multiple sports = a double/brick day. */
  days: (TrainingSport[] | null)[];
}

export interface ScheduleDay {
  weekday: string;
  sports: TrainingSport[];
  suggestedSports: TrainingSport[];
  source: "saved" | "inferred" | "unknown";
  evidence: Partial<Record<TrainingSport, number>>;
}

export interface ScheduleContext {
  saved: TrainingSchedule;
  days: ScheduleDay[];
  weeksObserved: number;
  from: string;
  through: string;
}

/** A completed (past) session, summarised for the calendar. */
export interface CompletedSession {
  id: string;
  date: string;
  sport: string;
  title: string;
  durationMin: number;
  distanceKm?: number;
  avgPower?: number;
  avgHr?: number;
  avgPaceSecKm?: number;
  powerEstimated?: boolean;
  loadEstimated: boolean;
  load: number;
}

export interface WorkoutBar {
  startSec: number;
  endSec: number;
  /** Mean speed (m/s), power (W), or heart rate (bpm). Null means missing data. */
  value: number | null;
  zone?: number;
}

export interface WorkoutProfile {
  metric: "pace" | "power" | "heartrate";
  bars: WorkoutBar[];
  estimated?: boolean;
}
