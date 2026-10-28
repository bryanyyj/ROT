import type { CompletedSession, PlannedSession } from "./api.js";
import { formatDuration, formatPace } from "./calendarData.js";

export const sportKind = (sport: string) => /swim/i.test(sport) ? "swim" : /ride|cycl/i.test(sport) ? "ride" : /run/i.test(sport) ? "run" : "other";
export const sportName = (sport: string) => ({ swim: "Swimming", ride: "Cycling", run: "Running", other: sport })[sportKind(sport)];
export const sportNoun = (sport: string) => ({ swim: "swim", ride: "ride", run: "run", other: "workout" })[sportKind(sport)];

/** Label/value pairs shown under a workout, shared by the calendar card and the chat summary. */
export function workoutMetrics(session: CompletedSession | PlannedSession, completed?: CompletedSession): [string, string][] {
  const kind = sportKind(session.sport);
  const third: [string, string] = kind === "ride"
    ? ["Avg power", completed?.avgPower !== undefined ? `${completed.powerEstimated ? "≈" : ""}${Math.round(completed.avgPower)} W` : "—"]
    : kind === "run" ? ["Avg pace", formatPace(completed?.avgPaceSecKm)]
    : ["Avg HR", completed?.avgHr !== undefined ? `${completed.avgHr} bpm` : "—"];
  return [
    ["Duration", formatDuration(session.durationMin)],
    ["Distance", completed?.distanceKm !== undefined ? `${completed.distanceKm.toFixed(1)} km` : "—"],
    third,
    [completed?.loadEstimated ? "Est. load" : "Load", completed ? String(Math.round(completed.load)) : "—"],
  ];
}
