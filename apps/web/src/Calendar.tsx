import { useEffect, useState } from "react";
import { getWeek, getStatus, connectStrava, type WeekData, type Status, type Intensity } from "./api.js";

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

const INTENSITY_TONE: Record<Intensity, string> = {
  rest: "rest",
  easy: "easy",
  tempo: "tempo",
  threshold: "hard",
  vo2: "hard",
  long: "long",
};

const todayIso = () => new Date().toISOString().slice(0, 10);

function fmt(dateIso: string): { dow: string; day: string } {
  const d = new Date(dateIso + "T00:00:00");
  return {
    dow: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
  };
}

function relDay(dateIso: string): string {
  if (dateIso === todayIso()) return "Today";
  const t = new Date(todayIso() + "T00:00:00").getTime();
  const d = new Date(dateIso + "T00:00:00").getTime();
  const diff = Math.round((d - t) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return "";
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

  if (week.planned.length === 0 && week.past.length === 0) {
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
        <p className="muted small">Planned sessions ahead, completed sessions behind. Source: {week.source}.</p>
      </header>

      <h2 className="section-label">Planned</h2>
      <ol className="agenda">
        {week.planned.map((p) => {
          const { dow, day } = fmt(p.date);
          const rel = relDay(p.date);
          const isToday = p.date === todayIso();
          return (
            <li key={p.date} className={`agenda-row ${isToday ? "is-today" : ""}`}>
              <div className="agenda-date">
                <span className="agenda-dow">{dow}</span>
                <span className="agenda-day">{day.split(" ")[0]}</span>
              </div>
              <div className={`sess tone-${INTENSITY_TONE[p.intensity]}`}>
                <div className="sess-top">
                  <span className="sess-title"><span className="dot" />{p.title}</span>
                  {p.intensity !== "rest" && <span className="sess-dur">{p.durationMin}m</span>}
                </div>
                <span className="sess-rationale">{rel && <b>{rel} · </b>}{p.rationale}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {week.past.length > 0 && <h2 className="section-label">Completed</h2>}
      <ol className="agenda">
        {week.past.map((c, i) => {
          const { dow, day } = fmt(c.date);
          return (
            <li key={`${c.date}-${i}`} className="agenda-row">
              <div className="agenda-date">
                <span className="agenda-dow">{dow}</span>
                <span className="agenda-day">{day.split(" ")[0]}</span>
              </div>
              <div className="sess done">
                <div className="sess-top">
                  <span className="sess-title"><span className="dot" />{c.title}</span>
                  <span className="sess-dur">{c.durationMin}m</span>
                </div>
                <span className="sess-rationale">
                  {c.sport}
                  {c.distanceKm ? ` · ${c.distanceKm.toFixed(1)} km` : ""} · load {c.load}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
