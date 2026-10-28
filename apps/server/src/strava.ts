import { config } from "./config.js";
import { store } from "./store.js";
import type { Activity } from "./types.js";
import { buildWorkoutProfile, type ActivityStreams, type ActivityZone } from "./workout.js";

const AUTH_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";
const API = "https://www.strava.com/api/v3";

export function authorizeUrl(): string {
  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    response_type: "code",
    redirect_uri: config.strava.redirectUri,
    approval_prompt: "auto",
    scope: "read,activity:read_all",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Strava token exchange failed: ${res.status}`);
  const t = (await res.json()) as TokenResponse;
  store.setStrava({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at });
}

async function validAccessToken(): Promise<string> {
  const tokens = store.getStrava();
  if (!tokens) throw new Error("Strava not connected");
  if (tokens.expiresAt > Math.floor(Date.now() / 1000) + 60) return tokens.accessToken;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);
  const t = (await res.json()) as TokenResponse;
  store.setStrava({ accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: t.expires_at });
  return t.access_token;
}

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  start_date_local: string;
  moving_time: number; // seconds
  distance: number; // metres
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number; // Strava "relative effort" ~ TRIMP
  average_watts?: number;
  average_speed?: number;
  device_watts?: boolean;
}

/** Fetch recent activities and store them as the active data source. */
export async function syncActivities(): Promise<Activity[]> {
  const token = await validAccessToken();
  // A year of history feeds the status chart and the calendar; 200 per page keeps it to a few requests.
  const after = Math.floor(Date.now() / 1000) - 366 * 86400;
  const raw: StravaActivity[] = [];
  for (let page = 1; page <= 5; page++) {
    const res = await fetch(`${API}/athlete/activities?per_page=200&page=${page}&after=${after}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(res.status === 429 ? "Strava's request limit was reached. Try syncing again later." : `Strava activities fetch failed: ${res.status}`);
    const batch = (await res.json()) as StravaActivity[];
    raw.push(...batch);
    if (batch.length < 200) break;
  }
  const activities: Activity[] = raw.map((a) => {
    const act: Activity = {
      id: String(a.id),
      date: a.start_date_local.slice(0, 10),
      type: a.sport_type ?? a.type,
      name: a.name,
      durationMin: a.moving_time / 60,
      avgPower: a.average_watts,
      avgSpeedMps: a.average_speed,
      powerEstimated: a.average_watts !== undefined && a.device_watts !== true,
      profile: store.getActivities().find((old) => old.source === "strava" && old.id === String(a.id))?.profile,
      source: "strava",
    };
    if (a.distance) act.distanceKm = a.distance / 1000;
    if (a.average_heartrate) act.avgHr = Math.round(a.average_heartrate);
    if (a.max_heartrate) act.maxHr = Math.round(a.max_heartrate);
    if (typeof a.suffer_score === "number") act.trainingLoad = a.suffer_score;
    return act;
  });
  store.setActivities(activities, "strava");
  await syncAthlete(token);
  return activities;
}

/** FTP and weight are optional athlete settings; failing to read them never blocks a sync. */
async function syncAthlete(token: string): Promise<void> {
  try {
    const res = await fetch(`${API}/athlete`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const a = (await res.json()) as { ftp?: number | null; weight?: number | null };
    store.setStravaAthlete({
      ...(a.ftp ? { ftp: Math.round(a.ftp) } : {}),
      ...(a.weight ? { weightKg: Math.round(a.weight * 10) / 10 } : {}),
    });
  } catch { /* Optional. */ }
}

/** Load detailed recordings on demand, rather than spending API calls on closed weeks. */
export async function fetchWorkoutProfile(activity: Activity) {
  const token = await validAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const id = encodeURIComponent(activity.id);
  const response = await fetch(`${API}/activities/${id}/streams?keys=time,watts,velocity_smooth,heartrate&key_by_type=true`, { headers });
  if (response.status === 404) return null; // Manual activities have no recording.
  if (!response.ok) throw new Error(response.status === 429
    ? "Strava's request limit was reached. Try loading the graph again later."
    : `Could not load the workout recording (${response.status}).`);
  const streams = await response.json() as ActivityStreams;
  // Activity zone ranges may be unavailable for this athlete; raw measurements still work.
  let zones: ActivityZone[] = [];
  try {
    const zoneResponse = await fetch(`${API}/activities/${id}/zones`, { headers });
    if (zoneResponse.ok) zones = await zoneResponse.json() as ActivityZone[];
  } catch { /* Optional zone labels. */ }
  return buildWorkoutProfile(activity, streams, zones);
}
