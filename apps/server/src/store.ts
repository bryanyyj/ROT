import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Activity, DataSource, Wellness } from "./types.js";
import { sampleActivities, sampleWellness } from "./sampleData.js";

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
}

let data: StoreData = load();

function load(): StoreData {
  try {
    return JSON.parse(readFileSync(FILE, "utf8")) as StoreData;
  } catch {
    return { source: "sample", activities: [] };
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
  /** Activities from the connected source, or sample data when nothing is connected. */
  getActivities(): Activity[] {
    if (data.source === "sample" || data.activities.length === 0) return sampleActivities();
    return data.activities;
  },

  getWellness(): Wellness {
    return data.wellness ?? sampleWellness();
  },

  setWellness(w: Wellness): void {
    data.wellness = w;
    persist();
  },

  getSource(): DataSource {
    return data.activities.length > 0 ? data.source : "sample";
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
    data = { source: "sample", activities: [] };
    persist();
  },
};
