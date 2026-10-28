import { useEffect, useState } from "react";
import { getContext, getFormHistory, getStatus, connectStrava, syncStrava, type CoachContext, type FormPoint, type Status } from "./api.js";
import { ConnectData } from "./Calendar.js";
import { TrainingWeek } from "./TrainingWeek.js";
import { AthleteCard } from "./AthleteCard.js";
import { TrainingStatusCard, TrainingStatusDetail } from "./TrainingStatus.js";

export function Profile() {
  const [ctx, setCtx] = useState<CoachContext | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [form, setForm] = useState<FormPoint[] | null>(null);
  const [detail, setDetail] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  useEffect(() => {
    getContext().then(setCtx).catch(() => {});
    getStatus().then(setStatus).catch(() => {});
    getFormHistory().then(setForm).catch(() => setForm([]));
  }, []);

  async function sync() {
    setSyncing(true); setSyncMsg("");
    try {
      const count = await syncStrava();
      setSyncMsg(`Synced ${count} activities from the last year.`);
      getContext().then(setCtx).catch(() => {});
      getStatus().then(setStatus).catch(() => {});
      getFormHistory().then(setForm).catch(() => {});
    } catch (e) { setSyncMsg(e instanceof Error ? e.message : "Sync failed."); }
    finally { setSyncing(false); }
  }

  if (detail) return <div className="view-scroll view-pad"><TrainingStatusDetail points={form ?? []} onBack={() => setDetail(false)} /></div>;

  return (
    <div className="view-scroll view-pad">
      <header className="view-head">
        <h1>Profile</h1>
        <p className="muted small">Your training load and recovery at a glance.</p>
      </header>

      {status?.source === "none" && <ConnectData status={status} />}
      <AthleteCard />
      {ctx && status?.source !== "none" && <StatusAndFitness ctx={ctx} form={form} onOpen={() => setDetail(true)} />}

      <h2 className="section-label">Training load</h2>
      <div className="metric-grid">
        <Metric
          label="Load ratio"
          sub="ACWR"
          value={ctx?.readiness.metrics.acwr !== undefined ? ctx.readiness.metrics.acwr.toFixed(2) : "—"}
        />
        <Metric label="7-day load" sub="acute" value={ctx ? String(ctx.weekLoad) : "—"} />
        <Metric label="Activities" sub="loaded" value={ctx ? String(ctx.totalActivities) : "—"} />
      </div>

      <TrainingWeek />

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
        {status?.strava.connected && (
          <>
            <button className="btn-sm" onClick={sync} disabled={syncing}>{syncing ? "Syncing…" : "Sync Strava now"}</button>
            {syncMsg && <p className="muted small" role="status">{syncMsg}</p>}
          </>
        )}
        {status?.strava.configured && !status.strava.connected && (
          <button className="btn-sm" onClick={connectStrava}>Connect Strava</button>
        )}
        <Row label="Garmin" value="needs developer approval" />
      </div>
    </div>
  );
}

/** Training status (chart preview) and fitness, side by side at half width each. */
function StatusAndFitness({ ctx, form, onOpen }: { ctx: CoachContext; form: FormPoint[] | null; onOpen: () => void }) {
  const m = ctx.readiness.metrics;
  return (
    <div className="status-pair">
      <TrainingStatusCard points={form} onOpen={onOpen} />
      <section className="card status-card" aria-labelledby="fitness-title">
        <h2 id="fitness-title" className="result-kicker">Fitness</h2>
        <p className="status-value">{m.ctl.toFixed(0)}</p>
        <p className="status-sub">Fatigue <b>{m.atl.toFixed(0)}</b> · Form <b className={m.tsb < 0 ? "neg" : ""}>{m.tsb.toFixed(0)}</b></p>
      </section>
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
