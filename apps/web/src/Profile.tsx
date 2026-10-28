import { useEffect, useState } from "react";
import { getContext, getStatus, connectStrava, type CoachContext, type Status } from "./api.js";
import { CheckIn } from "./CheckIn.js";

const REC_LABEL: Record<string, string> = {
  TRAIN_HARD: "Train hard",
  TRAIN_EASY: "Go easy",
  REST: "Rest",
};

export function Profile() {
  const [ctx, setCtx] = useState<CoachContext | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    getContext().then(setCtx).catch(() => {});
    getStatus().then(setStatus).catch(() => {});
  }, []);

  return (
    <div className="view-scroll view-pad">
      <header className="view-head">
        <h1>Profile</h1>
        <p className="muted small">Your training load and recovery at a glance.</p>
      </header>

      {ctx && <ReadinessBlock ctx={ctx} />}

      <h2 className="section-label">Training load</h2>
      <div className="metric-grid">
        <Metric label="Fitness" sub="CTL" value={ctx ? ctx.readiness.metrics.ctl.toFixed(0) : "—"} />
        <Metric label="Fatigue" sub="ATL" value={ctx ? ctx.readiness.metrics.atl.toFixed(0) : "—"} />
        <Metric label="Form" sub="TSB" value={ctx ? ctx.readiness.metrics.tsb.toFixed(0) : "—"} signed />
        <Metric
          label="Load ratio"
          sub="ACWR"
          value={ctx?.readiness.metrics.acwr !== undefined ? ctx.readiness.metrics.acwr.toFixed(2) : "—"}
        />
        <Metric label="7-day load" sub="acute" value={ctx ? String(ctx.weekLoad) : "—"} />
        <Metric label="Activities" sub="loaded" value={ctx ? String(ctx.totalActivities) : "—"} />
      </div>

      <h2 className="section-label">Data &amp; connections</h2>
      <div className="card conn">
        <Row label="Data source" value={status?.source ?? "…"} />
        <Row
          label="Coach model"
          value={status ? (status.openRouter.configured ? status.openRouter.model : "not configured") : "…"}
          ok={status?.openRouter.configured}
        />
        <Row
          label="Strava"
          value={status ? (status.strava.connected ? "connected" : status.strava.configured ? "ready to connect" : "not set up") : "…"}
          ok={status?.strava.connected}
        />
        {status?.strava.configured && !status.strava.connected && (
          <button className="btn-sm" onClick={connectStrava}>Connect Strava</button>
        )}
        <Row label="Garmin" value="needs developer approval" />
      </div>

      <h2 className="section-label">Daily check-in</h2>
      <CheckIn />
    </div>
  );
}

function ReadinessBlock({ ctx }: { ctx: CoachContext }) {
  const r = ctx.readiness;
  const tone = r.recommendation.toLowerCase().replace("_", "-");
  return (
    <div className={`card readiness tone-${tone}`}>
      <div className="readiness-head">
        <div>
          <span className="result-kicker">Today</span>
          <h2 className="result-rec">{REC_LABEL[r.recommendation]}</h2>
        </div>
        <div className="score-ring">
          <span className="score-num">{r.readinessScore}</span>
          <span className="score-unit">/100</span>
        </div>
      </div>
      <ul className="drivers">{r.drivers.map((d, i) => <li key={i}>{d}</li>)}</ul>
    </div>
  );
}

function Metric({ label, sub, value, signed }: { label: string; sub: string; value: string; signed?: boolean }) {
  const neg = signed && value.startsWith("-");
  return (
    <div className="metric">
      <span className={`metric-value ${neg ? "neg" : ""}`}>{value}</span>
      <span className="metric-label">{label}</span>
      <span className="metric-sub">{sub}</span>
    </div>
  );
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="conn-row">
      <span className="conn-label">{label}</span>
      <span className={`conn-value ${ok === true ? "ok" : ok === false ? "off" : ""}`}>{value}</span>
    </div>
  );
}
