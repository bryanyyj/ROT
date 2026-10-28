import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getWeek, getStatus, connectStrava, type WeekData, type Status } from "./api.js";
import { ChevronIcon } from "./icons.js";
import { buildWeeks, earliestMondayIso, localIso, type DayCell, type WeekGroup } from "./calendarData.js";
import { WorkoutCard } from "./WorkoutCard.js";

export function ConnectData({ status }: { status: Status | null }) {
  return (
    <div className="card empty-connect">
      <h2>Connect your training</h2>
      <p className="muted">Link Strava to see your rides, runs and swims, and get coaching based on your training.</p>
      {status?.strava.configured ? (
        <button className="btn-sm" onClick={connectStrava}>Connect Strava</button>
      ) : <p className="chat-note">Strava isn’t configured yet. Add your connection details in the server settings to get started.</p>}
    </div>
  );
}

/** Older weeks arrive in batches as the user scrolls back toward the top. */
const BATCH = 10;

export function Calendar() {
  const [week, setWeek] = useState<WeekData | null>(null);
  const [weeksBack, setWeeksBack] = useState(BATCH);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heightBeforeLoad = useRef(0);
  const positioned = useRef(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    getWeek().then(setWeek).catch(() => setErr("Could not load your calendar. Is the coach server running?"));
    getStatus().then(setStatus).catch(() => {});
  }, []);
  const now = new Date();
  const weeks = week ? buildWeeks(week, now, weeksBack) : [];
  const earliest = week ? earliestMondayIso(week, now) : undefined;
  const hasOlder = !!earliest && !!weeks.length && weeks[0]!.mondayIso > earliest;

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !weeks.length) return;
    if (!positioned.current) {
      // Land on the current week; older weeks wait above, out of sight.
      const current = el.querySelector<HTMLElement>("[data-current]");
      if (current) el.scrollTop = current.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 12;
      positioned.current = true;
    } else if (heightBeforeLoad.current) {
      // Keep what the user was looking at in place after weeks are inserted above it.
      el.scrollTop += el.scrollHeight - heightBeforeLoad.current;
      heightBeforeLoad.current = 0;
    }
  }, [weeks.length, week]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || !hasOlder || heightBeforeLoad.current || el.scrollTop > 160) return;
    heightBeforeLoad.current = el.scrollHeight;
    setWeeksBack((n) => n + BATCH);
  }

  if (err) return <div className="view-pad"><div className="flash err" role="alert">{err}</div></div>;
  if (!week) return <div className="view-pad"><p className="muted">Loading your calendar…</p></div>;
  return (
    <div className="view-scroll view-pad" ref={scrollRef} onScroll={onScroll}>
      <header className="view-head">
        <h1>Calendar</h1>
        <p className="muted small">Your training, Monday to Sunday.</p>
      </header>
      {hasOlder && <p className="muted small cal-older">Scroll up for earlier weeks</p>}
      {weeks.length ? weeks.map((w) => <WeekSection key={w.mondayIso} week={w} />) : <ConnectData status={status} />}
    </div>
  );
}

function WeekSection({ week }: { week: WeekGroup }) {
  const [open, setOpen] = useState(week.open);
  const [visited, setVisited] = useState(week.open);
  return (
    <details className="week" data-current={week.open || undefined} open={open} onToggle={(event) => {
      setOpen(event.currentTarget.open);
      if (event.currentTarget.open) setVisited(true);
    }}>
      <summary className="week-sum">
        <ChevronIcon />
        <span className="week-heading">
          <span className="week-title">{week.label}</span>
          {week.label !== week.range && <span className="week-range">{week.range}</span>}
          <span className="week-meta">
            {week.hasCompleted || !week.plannedMin ? <><b>{(week.completedMin / 60).toFixed(1)} h</b> training <span aria-hidden="true">·</span> <b>{Math.round(week.totalLoad)}</b> load</>
              : <><b>{(week.plannedMin / 60).toFixed(1)} h</b> planned <span aria-hidden="true">·</span> Load —</>}
            {week.hasCompleted && week.plannedMin > 0 && <span className="week-planned"> + {(week.plannedMin / 60).toFixed(1)} h planned</span>}
          </span>
        </span>
      </summary>
      {visited && <ol className="week-days">{week.days.map((day) => <DayRow key={day.iso} day={day} active={open} />)}</ol>}
    </details>
  );
}

function DayRow({ day, active }: { day: DayCell; active: boolean }) {
  const empty = !day.completed.length && !day.planned.length;
  return (
    <li className={`day ${day.iso === localIso(new Date()) ? "is-today" : ""}`}>
      <time className="day-date" dateTime={day.iso}>
        <span className="day-dow">{day.date.toLocaleDateString(undefined, { weekday: "short" })}</span>
        <span className="day-num">{day.date.getDate()}</span>
      </time>
      <div className="day-sessions">
        {day.completed.map((session) => <WorkoutCard key={session.id} completed={session} active={active} />)}
        {day.planned.map((session) => <WorkoutCard key={session.id} planned={session} active={active} />)}
        {empty && <span className="day-rest">{day.iso > localIso(new Date()) ? "No workout planned" : "No workout recorded"}</span>}
      </div>
    </li>
  );
}
