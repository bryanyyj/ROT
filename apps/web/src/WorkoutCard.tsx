import { useContext, useEffect, useState } from "react";
import { getWorkoutProfile, type CompletedSession, type PlannedSession, type WorkoutProfile } from "./api.js";
import { formatDuration, formatPace } from "./calendarData.js";
import { ReviewContext } from "./reviewContext.js";
import { workoutMetrics } from "./workoutMetrics.js";

function barLabel(profile: WorkoutProfile, index: number): string {
  const bar = profile.bars[index]!;
  if (bar.value === null) return "No data";
  const measurement = profile.metric === "pace" ? bar.value > 0 ? formatPace(1000 / bar.value) : "Stopped"
    : `${Math.round(bar.value)} ${profile.metric === "power" ? "W" : "bpm"}`;
  return `${bar.zone ? `Z${bar.zone} · ` : ""}${measurement}`;
}

function timeLabel(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function WorkoutGraph({ profile }: { profile: WorkoutProfile }) {
  const [selected, setSelected] = useState(0);
  const bar = profile.bars[selected];
  if (!bar) return <p className="graph-note">No intensity recording available.</p>;
  const max = Math.max(1, ...profile.bars.map((b) => b.value ?? 0));
  const metric = profile.metric === "pace" ? "Pace" : profile.metric === "power" ? "Power" : "Heart rate";
  return (
    <figure className="workout-graph">
      <figcaption className="graph-caption">{profile.estimated ? "Estimated " : ""}{metric} throughout workout · interval averages</figcaption>
      <div className="workout-bars" role="group" aria-label={`${metric} over elapsed time. Select a bar for details.`}>
        {profile.bars.map((b, i) => (
          <button type="button" key={i} className={`workout-bar zone-${b.zone ?? "unknown"} ${b.value === null ? "missing" : ""}`}
            style={{ height: `${b.value === null ? 4 : Math.max(3, b.value / max * 100)}%` }}
            aria-pressed={i === selected}
            aria-label={`${timeLabel(b.startSec)} to ${timeLabel(b.endSec)}: ${barLabel(profile, i)}`}
            title={`${timeLabel(b.startSec)}–${timeLabel(b.endSec)}: ${barLabel(profile, i)}`}
            onFocus={() => setSelected(i)} onMouseEnter={() => setSelected(i)} onClick={() => setSelected(i)} />
        ))}
      </div>
      <div className="graph-axis"><span>0:00</span><span>Elapsed time</span><span>{timeLabel(profile.bars.at(-1)!.endSec)}</span></div>
      <p className="graph-reading" aria-live="polite"><span>{timeLabel(bar.startSec)}–{timeLabel(bar.endSec)}</span><strong>{barLabel(profile, selected)}</strong></p>
      {profile.metric !== "pace" && !profile.bars.some((b) => b.zone) && <p className="graph-note">Zone ranges unavailable; showing {metric.toLowerCase()}.</p>}
    </figure>
  );
}

export function WorkoutCard({ completed, planned, active }: { completed?: CompletedSession; planned?: PlannedSession; active: boolean }) {
  const session = completed ?? planned!;
  const [profile, setProfile] = useState<WorkoutProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [graphError, setGraphError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const startReview = useContext(ReviewContext);
  useEffect(() => {
    if (!completed || !active || loaded) return;
    let cancelled = false;
    setGraphError("");
    getWorkoutProfile(completed.id).then((data) => {
      if (!cancelled) { setProfile(data); setLoaded(true); }
    }).catch((error: Error) => { if (!cancelled) setGraphError(error.message); });
    return () => { cancelled = true; };
  }, [completed?.id, active, loaded, attempt]);

  const rest = planned?.intensity === "rest";
  return (
    <article className={`sess ${completed ? "done" : "planned"}`}>
      <div className="sess-top">
        <h3 className="sess-title">{session.title}</h3>
        {!rest && <button className="review-btn" onClick={() => startReview({ session: completed ?? planned!, completed: !!completed, profile })} aria-label={`Review ${session.title} in chat`}>Review</button>}
      </div>
      <span className="sess-rationale">{session.sport} · {completed ? "Completed" : "Planned"}</span>
      {completed && (profile ? <WorkoutGraph profile={profile} /> : graphError ? <div className="graph-note" role="alert">{graphError} <button className="text-btn" onClick={() => setAttempt(attempt + 1)}>Retry graph</button></div>
        : <p className="graph-note">{loaded ? "No intensity recording available for this workout." : "Loading workout graph…"}</p>)}
      {planned && !rest && <div className="planned-profile">
        <div className={`planned-intensity intensity-${planned.intensity}`}>{planned.intensity === "long" ? "Endurance" : planned.intensity} · {formatDuration(planned.durationMin)}</div>
        <p className="graph-note">Target intensity · workout has not been recorded yet.</p>
      </div>}
      {!rest && <dl className="workout-metrics">
        {workoutMetrics(session, completed).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>}
      {planned && <p className="sess-rationale">{planned.rationale}</p>}
    </article>
  );
}
