export type DataSource = "strava" | "garmin" | "sample" | "import";

/** A single training activity, normalised across sources. */
export interface Activity {
  id: string;
  date: string; // YYYY-MM-DD (local)
  type: string; // Run | Ride | Swim | ...
  name?: string;
  durationMin: number;
  distanceKm?: number;
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
