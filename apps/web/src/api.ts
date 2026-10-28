import type { ReadinessResult } from "@rot/engine";

export interface Status {
  openRouter: { configured: boolean; model: string; free?: boolean; freeOnly?: boolean };
  strava: { configured: boolean; connected: boolean };
  garmin: { available: boolean; reason: string };
  source: string;
  activities: number;
}

export interface Activity {
  id: string;
  date: string;
  type: string;
  name?: string;
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  trainingLoad?: number;
}

export interface CoachContext {
  readiness: ReadinessResult;
  recent: Activity[];
  weekLoad: number;
  source: string;
  totalActivities: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type Intensity = "rest" | "easy" | "tempo" | "threshold" | "vo2" | "long";

export interface PlannedSession {
  date: string;
  sport: string;
  title: string;
  intensity: Intensity;
  durationMin: number;
  rationale: string;
}

export interface CompletedSession {
  date: string;
  sport: string;
  title: string;
  durationMin: number;
  distanceKm?: number;
  load: number;
}

export interface WeekData {
  planned: PlannedSession[];
  past: CompletedSession[];
  readiness: ReadinessResult;
  source: string;
}

export async function getWeek(): Promise<WeekData> {
  const r = await fetch("/api/week");
  return r.json();
}

export async function getStatus(): Promise<Status> {
  const r = await fetch("/api/status");
  return r.json();
}

export async function getContext(): Promise<CoachContext> {
  const r = await fetch("/api/context");
  return r.json();
}

export async function postWellness(w: object): Promise<void> {
  await fetch("/api/wellness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(w),
  });
}

export async function getPlan(): Promise<string> {
  const r = await fetch("/api/plan", { method: "POST" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? "Plan failed");
  return j.plan as string;
}

/** POST chat history; stream assistant text via onDelta. */
export async function streamChat(
  messages: ChatMessage[],
  onDelta: (text: string) => void,
): Promise<void> {
  const r = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({ error: "Chat failed" }));
    throw new Error(j.error ?? "Chat failed");
  }
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    onDelta(decoder.decode(value, { stream: true }));
  }
}

export function connectStrava(): void {
  window.location.href = "/api/strava/connect";
}
