import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Activity, AthleteProfile, DataSource, PlannedSession, Wellness, WorkoutProfile, TrainingSchedule } from "./types.js";
import { todayInZone } from "./dates.js";

const todayIso = () => todayInZone(data.trainingSchedule?.timeZone);

const here = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(here, "../data/store.json");

interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // unix seconds
}

interface StoreData {
  source: DataSource;
  strava?: StravaTokens;
  activities: Activity[];
  wellness?: Wellness;
  trainingSchedule?: TrainingSchedule;
  aiPlan?: PlannedSession[];
  athlete?: AthleteProfile;
  stravaAthlete?: AthleteProfile;
}

let data: StoreData = load();

function load(): StoreData {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as StoreData;
  } catch {
    return { source: "none", activities: [] };
  }
}

function persist(): void {
  try {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch {
    /* non-fatal: in-memory still works */
  }
}

export const store = {
  getTrainingSchedule(): TrainingSchedule {
    return data.trainingSchedule ?? { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, days: Array.from({ length: 7 }, () => null) };
  },

  setTrainingSchedule(schedule: TrainingSchedule): void {
    const previous = data.trainingSchedule;
    data.trainingSchedule = schedule;
    try {
      mkdirSync(dirname(FILE), { recursive: true });
      writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      data.trainingSchedule = previous;
      throw error; // Do not report a persistent preference as saved if writing failed.
    }
  },
  getAthlete(): { manual: AthleteProfile; synced: AthleteProfile } {
    return { manual: data.athlete ?? {}, synced: data.stravaAthlete ?? {} };
  },

  setAthlete(profile: AthleteProfile): void {
    data.athlete = profile;
    persist();
  },

  setStravaAthlete(profile: AthleteProfile): void {
    data.stravaAthlete = profile;
    persist();
  },

  getAiPlan(): PlannedSession[] {
    return data.aiPlan ?? [];
  },

  setAiPlan(sessions: PlannedSession[]): void {
    data.aiPlan = sessions;
    persist();
  },

  /** Activities from the connected source. Empty until a source is connected. */
  getActivities(): Activity[] {
    return data.activities;
  },

  getWellness(): Wellness {
    return data.wellness ?? { date: todayIso() };
  },

  setWorkoutProfile(id: string, profile: WorkoutProfile): void {
    const activity = data.activities.find((a) => a.id === id);
    if (activity) {
      activity.profile = profile;
      persist();
    }
  },

  setWellness(w: Wellness): void {
    data.wellness = w;
    persist();
  },

  getSource(): DataSource {
    return data.activities.length > 0 ? data.source : "none";
  },

  setActivities(activities: Activity[], source: DataSource): void {
    data.activities = activities;
    data.source = source;
    persist();
  },

  getStrava(): StravaTokens | undefined {
    return data.strava;
  },

  setStrava(tokens: StravaTokens): void {
    data.strava = tokens;
    persist();
  },

  reset(): void {
    data = { source: "none", activities: [] };
    persist();
  },
};
