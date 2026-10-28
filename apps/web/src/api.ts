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

/** A workout shown inside the chat (review request chip and summary card). */
export interface WorkoutAttachment {
  session: CompletedSession | PlannedSession;
  completed: boolean;
  profile: WorkoutProfile | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  workout?: WorkoutAttachment;
  /** True for a workout review reply, which is laid out as verdict · card · details. */
  review?: boolean;
}

export type Intensity = "rest" | "easy" | "tempo" | "threshold" | "vo2" | "long";

export interface PlannedSession {
  id: string;
  date: string;
  sport: string;
  title: string;
  intensity: Intensity;
  durationMin: number;
  rationale: string;
}

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

export interface WorkoutProfile {
  metric: "pace" | "power" | "heartrate";
  bars: { startSec: number; endSec: number; value: number | null; zone?: number }[];
  estimated?: boolean;
}

export async function getWorkoutProfile(id: string): Promise<WorkoutProfile | null> {
  const r = await fetch(`/api/workouts/${encodeURIComponent(id)}/profile`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Could not load workout graph.");
  return data.profile;
}

export async function reviewWorkout(target: { activityId: string } | { plannedId: string }): Promise<string> {
  const r = await fetch("/api/workouts/review", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, timeZone: clientTimeZone() }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Could not review this workout.");
  return data.review;
}

export interface WeekData {
  planned: PlannedSession[];
  past: CompletedSession[];
  readiness: ReadinessResult;
  source: string;
}

export async function getWeek(): Promise<WeekData> {
  const r = await fetch(`/api/week?timeZone=${encodeURIComponent(clientTimeZone())}`);
  if (!r.ok) throw new Error("Could not load your calendar.");
  return r.json();
}

export interface FormPoint { date: string; tsb: number }
export async function getFormHistory(): Promise<FormPoint[]> {
  const r = await fetch(`/api/form-history?timeZone=${encodeURIComponent(clientTimeZone())}`);
  if (!r.ok) throw new Error("Could not load your training status history.");
  return (await r.json()).points;
}

export async function getStatus(): Promise<Status> {
  const r = await fetch("/api/status");
  return r.json();
}

export async function getContext(): Promise<CoachContext> {
  const r = await fetch(`/api/context?timeZone=${encodeURIComponent(clientTimeZone())}`);
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
  const r = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ timeZone: clientTimeZone() }) });
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
    body: JSON.stringify({
      messages: messages.filter((m) => m.content.trim()).map(({ role, content }) => ({ role, content })),
      timeZone: clientTimeZone(),
    }),
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

const clientTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export type TrainingSport = "Swim" | "Ride" | "Run";
export interface TrainingSchedule {
  timeZone: string;
  days: (TrainingSport[] | null)[];
}
export interface ScheduleContext {
  saved: TrainingSchedule;
  days: { weekday: string; sports: TrainingSport[]; suggestedSports: TrainingSport[]; source: "saved" | "inferred" | "unknown"; evidence: Partial<Record<TrainingSport, number>> }[];
  weeksObserved: number;
  from: string;
  through: string;
}
export async function getTrainingSchedule(): Promise<ScheduleContext> {
  const r = await fetch(`/api/training-schedule?timeZone=${encodeURIComponent(clientTimeZone())}`);
  if (!r.ok) throw new Error("Could not load your training week.");
  return r.json();
}
export async function saveTrainingSchedule(days: TrainingSchedule["days"]): Promise<ScheduleContext> {
  const r = await fetch("/api/training-schedule", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days, timeZone: clientTimeZone() }),
  });
  const result = await r.json();
  if (!r.ok) throw new Error(result.error ?? "Could not save your training week.");
  return result;
}

export interface AthleteValue { value: number; source: "manual" | "strava" }
export interface AthleteData {
  ftp: AthleteValue | null;
  thresholdPaceSecKm: AthleteValue | null;
  weightKg: AthleteValue | null;
  hrv: { value: number; date: string } | null;
  restingHr: { value: number; date: string } | null;
}
export async function getAthlete(): Promise<AthleteData> {
  const r = await fetch("/api/athlete");
  if (!r.ok) throw new Error("Could not load your athlete details.");
  return r.json();
}
export async function saveAthlete(values: { ftp?: number | null; thresholdPaceSecKm?: number | null; weightKg?: number | null }): Promise<AthleteData> {
  const r = await fetch("/api/athlete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Could not save your athlete details.");
  return data;
}

export async function syncStrava(): Promise<number> {
  const r = await fetch("/api/strava/sync", { method: "POST" });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Sync failed.");
  return data.count;
}
