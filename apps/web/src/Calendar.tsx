import { useEffect, useState } from "react";
import {
  getWeek,
  getStatus,
  connectStrava,
  type WeekData,
  type Status,
  type Intensity,
  type PlannedSession,
  type CompletedSession,
} from "./api.js";
import { ChevronIcon } from "./icons.js";

const INTENSITY_TONE: Record<Intensity, string> = {
  rest: "rest",
  easy: "easy",
  tempo: "tempo",
  threshold: "hard",
  vo2: "hard",
  long: "long",
};

// ---- local date helpers (avoid UTC shift from toISOString) ----
const pad = (n: number) => String(n).padStart(2, "0");
const fmtIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => new Date(iso + "T00:00:00");
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
/** Monday of the week containing d. */
function mondayOf(d: Date): Date {
  const off = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  return addDays(d, -off);
}
const todayIso = fmtIso(new Date());

interface DayCell {
  iso: string;
  date: Date;
  completed: CompletedSession[];
  planned?: PlannedSession;
}
interface WeekGroup {
  mondayIso: string;
  label: string;
  range: string;
  totalLoad: number;
  open: boolean;
  days: DayCell[];
}

function buildWeeks(week: WeekData): WeekGroup[] {
  const completedBy = new Map<string, CompletedSession[]>();
  for (const c of week.past) {
    const arr = completedBy.get(c.date) ?? [];
    arr.push(c);
    completedBy.set(c.date, arr);
  }
  const plannedBy = new Map<string, PlannedSession>();
  for (const p of week.planned) plannedBy.set(p.date, p);

  const all = [...completedBy.keys(), ...plannedBy.keys()];
  if (all.length === 0) return [];
  const sorted = all.sort();
  const firstMon = mondayOf(parse(sorted[0]!));
  const lastMon = mondayOf(parse(sorted[sorted.length - 1]!));
  const curMon = mondayOf(new Date());

  const weeks: WeekGroup[] = [];
  for (let m = new Date(firstMon); m <= lastMon; m = addDays(m, 7)) {
    const diffWeeks = Math.round((m.getTime() - curMon.getTime()) / (7 * 86400000));
    const days: DayCell[] = [];
    let totalLoad = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(m, i);
      const iso = fmtIso(d);
      const completed = completedBy.get(iso) ?? [];
      totalLoad += completed.reduce((s, c) => s + c.load, 0);
      const cell: DayCell = { iso, date: d, completed };
      const planned = plannedBy.get(iso);
      if (planned && iso >= todayIso) cell.planned = planned;
      days.push(cell);
    }
    const sun = addDays(m, 6);
    weeks.push({
      mondayIso: fmtIso(m),
      label:
        diffWeeks === 0
          ? "This week"
          : diffWeeks === -1
            ? "Last week"
            : diffWeeks === 1
              ? "Next week"
              : diffWeeks < 0
                ? `${-diffWeeks} weeks ago`
                : `In ${diffWeeks} weeks`,
      range: `${m.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${sun.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`,
      totalLoad,
      open: diffWeeks <= 0 && diffWeeks >= -2,
      days,
    });
  }
  return weeks.reverse(); // most recent week first
}

export function ConnectData({ status }: { status: Status | null }) {
  const configured = status?.strava.configured;
  return (
    <div className="card empty-connect">
      <h2>Connect your training</h2>
      <p className="muted">
        This app uses your real activities — no demo data. Link Strava to sync your rides, runs and
        swims, and the coach will plan from your actual load and form.
      </p>
      {configured ? (
        <button className="btn-sm" onClick={connectStrava}>Connect Strava</button>
      ) : (
        <p className="chat-note">
          Add <code>STRAVA_CLIENT_ID</code> and <code>STRAVA_CLIENT_SECRET</code> to{" "}
          <code>apps/server/.env</code> (create an app at strava.com/settings/api, callback domain{" "}
          <code>localhost</code>), then restart the API server.
        </p>
      )}
    </div>
  );
}

export function Calendar() {
  const [week, setWeek] = useState<WeekData | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    getWeek().then(setWeek).catch(() => setErr("Could not load your calendar. Is the coach server running?"));
    getStatus().then(setStatus).catch(() => {});
  }, []);

  if (err) return <div className="view-pad"><div className="flash err">{err}</div></div>;
  if (!week) return <div className="view-pad"><p className="muted">Loading your calendar…</p></div>;

  const weeks = buildWeeks(week);

  if (weeks.length === 0) {
    return (
      <div className="view-scroll view-pad">
        <header className="view-head"><h1>Calendar</h1></header>
        <ConnectData status={status} />
      </div>
    );
  }

  return (
    <div className="view-scroll view-pad">
      <header className="view-head">
        <h1>Calendar</h1>
        <p className="muted small">Planned ahead, completed behind. Source: {week.source}.</p>
      </header>

      {weeks.map((w) => (
        <details key={w.mondayIso} className="week" open={w.open}>
          <summary className="week-sum">
            <span className="week-title">{w.label}</span>
            <span className="week-meta">
              {w.range}
              {w.totalLoad > 0 && <> · <b>{w.totalLoad}</b> load</>}
            </span>
            <ChevronIcon />
          </summary>
          <ol className="week-days">
            {w.days.map((day) => (
              <DayRow key={day.iso} day={day} />
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

function DayRow({ day }: { day: DayCell }) {
  const isToday = day.iso === todayIso;
  const dow = day.date.toLocaleDateString(undefined, { weekday: "short" });
  const dnum = day.date.getDate();
  const empty = day.completed.length === 0 && !day.planned;

  return (
    <li className={`day ${isToday ? "is-today" : ""}`}>
      <div className="day-date">
        <span className="day-dow">{dow}</span>
        <span className="day-num">{dnum}</span>
      </div>
      <div className="day-sessions">
        {day.completed.map((c, i) => (
          <div key={i} className="sess done">
            <div className="sess-top">
              <span className="sess-title"><span className="dot" />{c.title}</span>
              <span className="sess-load">{c.load}</span>
            </div>
            <span className="sess-rationale">
              {c.sport}
              {c.distanceKm ? ` · ${c.distanceKm.toFixed(1)} km` : ""} · {c.durationMin} min
            </span>
          </div>
        ))}
        {day.planned && (
          <div className={`sess planned tone-${INTENSITY_TONE[day.planned.intensity]}`}>
            <div className="sess-top">
              <span className="sess-title"><span className="dot" />{day.planned.title}</span>
              {day.planned.intensity !== "rest" && (
                <span className="sess-dur">{day.planned.durationMin}m</span>
              )}
            </div>
            <span className="sess-rationale">{day.planned.rationale}</span>
          </div>
        )}
        {empty && <span className="day-rest">Rest day</span>}
      </div>
    </li>
  );
}
