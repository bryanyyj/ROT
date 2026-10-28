import type { ComponentType } from "react";
import type { WorkoutAttachment, WorkoutProfile } from "./api.js";
import { formatDuration } from "./calendarData.js";
import { CoachText } from "./CoachText.js";
import { RideIcon, RunIcon, SwimIcon } from "./icons.js";
import { sportKind, sportName, workoutMetrics } from "./workoutMetrics.js";

const SPORT_ICON: Record<string, ComponentType<{ size?: number }>> = { swim: SwimIcon, ride: RideIcon, run: RunIcon };
const parseDay = (iso: string) => new Date(`${iso}T00:00:00`);

/** Bars share the width in proportion to elapsed time, like the recording they summarise. */
function Bars({ profile, count }: { profile: WorkoutProfile; count?: number }) {
  const bars = count && profile.bars.length > count
    ? Array.from({ length: count }, (_, i) => profile.bars[Math.floor(i * profile.bars.length / count)]!)
    : profile.bars;
  const max = Math.max(1, ...bars.map((b) => b.value ?? 0));
  return <>{bars.map((b, i) => (
    <span key={i} className={`summary-bar zone-${b.zone ?? "none"} ${b.value === null ? "missing" : ""}`}
      style={{ flexGrow: count ? 1 : Math.max(1, b.endSec - b.startSec), height: `${b.value === null ? 12 : Math.max(14, b.value / max * 100)}%` }} />
  ))}</>;
}

/** Compact "what I asked about" chip shown above the user's review request. */
export function WorkoutChip({ workout }: { workout: WorkoutAttachment }) {
  const { session, completed, profile } = workout;
  const day = parseDay(session.date);
  const detail = "load" in session ? `${formatDuration(session.durationMin)} · Load ${Math.round(session.load)}` : `Planned · ${formatDuration(session.durationMin)}`;
  return (
    <div className="wk-chip">
      <time className="wk-chip-date" dateTime={session.date}>
        <span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <strong>{day.getDate()}</strong>
      </time>
      <div className="wk-chip-main">
        <strong>{sportName(session.sport)}</strong>
        <span>{detail}</span>
      </div>
      {completed && profile && <div className="wk-chip-bars" aria-hidden="true"><Bars profile={profile} count={14} /></div>}
    </div>
  );
}

export function WorkoutSummaryCard({ workout }: { workout: WorkoutAttachment }) {
  const { session, completed, profile } = workout;
  const Icon = SPORT_ICON[sportKind(session.sport)];
  const day = parseDay(session.date);
  const done = "load" in session ? session : undefined;
  const metrics: [string, string][] = done ? workoutMetrics(session, done)
    : [["Duration", formatDuration(session.durationMin)], ["Intensity", "intensity" in session ? session.intensity : "—"]];
  return (
    <figure className="wk-card">
      <figcaption className="wk-card-head">
        {Icon && <span className="wk-card-icon"><Icon size={26} /></span>}
        <span className="wk-card-title">
          <strong>{sportName(session.sport)}</strong>
          <span>{session.title}{completed ? "" : " · planned"}</span>
        </span>
        <time className="wk-card-date" dateTime={session.date}>{day.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</time>
      </figcaption>
      {completed && profile && <div className="wk-card-bars" role="img" aria-label={`${profile.metric} throughout the workout`}><Bars profile={profile} /></div>}
      <dl className="wk-card-metrics">
        {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </figure>
  );
}

/** Verdict first, then the workout card, then the detail bullets. */
export function ReviewReply({ content, workout }: { content: string; workout: WorkoutAttachment }) {
  const split = content.search(/\n\s*\n/);
  const intro = split > 0 ? content.slice(0, split) : content;
  const rest = split > 0 ? content.slice(split).trim() : "";
  return (
    <div className="review-reply">
      <p className="review-done">Done</p>
      <CoachText>{intro}</CoachText>
      <WorkoutSummaryCard workout={workout} />
      {rest && <CoachText>{rest}</CoachText>}
    </div>
  );
}
