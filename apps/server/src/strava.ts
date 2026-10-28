import { config } from "./config.js";
import { store } from "./store.js";
import type { Activity } from "./types.js";

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
}

/** Fetch recent activities and store them as the active data source. */
export async function syncActivities(perPage = 60): Promise<Activity[]> {
  const token = await validAccessToken();
  const res = await fetch(`${API}/athlete/activities?per_page=${perPage}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Strava activities fetch failed: ${res.status}`);
  const raw = (await res.json()) as StravaActivity[];
  const activities: Activity[] = raw.map((a) => {
    const act: Activity = {
      id: String(a.id),
      date: a.start_date_local.slice(0, 10),
      type: a.sport_type ?? a.type,
      name: a.name,
      durationMin: Math.round(a.moving_time / 60),
      source: "strava",
    };
    if (a.distance) act.distanceKm = a.distance / 1000;
    if (a.average_heartrate) act.avgHr = Math.round(a.average_heartrate);
    if (a.max_heartrate) act.maxHr = Math.round(a.max_heartrate);
    if (typeof a.suffer_score === "number") act.trainingLoad = a.suffer_score;
    return act;
  });
  store.setActivities(activities, "strava");
  return activities;
}
