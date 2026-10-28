import { useMemo, useState } from "react";
import { recommend, type ReadinessResult, type Likert } from "@rot/engine";
import {
  loadEntries,
  saveEntry,
  todayIso,
  toEngineInput,
  type DailyEntry,
} from "./storage.js";
import { postWellness } from "./api.js";

const REC_LABEL: Record<string, string> = {
  TRAIN_HARD: "Train hard",
  TRAIN_EASY: "Go easy",
  REST: "Rest",
};

function numOrUndef(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function LikertField(props: {
  label: string;
  hint: string;
  value: Likert | undefined;
  onChange: (v: Likert) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-hint">{props.hint}</span>
      <div className="likert" role="radiogroup" aria-label={props.label}>
        {([1, 2, 3, 4, 5] as Likert[]).map((n) => (
          <button
            type="button"
            key={n}
            className={props.value === n ? "likert-btn on" : "likert-btn"}
            aria-pressed={props.value === n}
            onClick={() => props.onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </label>
  );
}

export function CheckIn() {
  const [entries, setEntries] = useState<DailyEntry[]>(() => loadEntries());
  const [date, setDate] = useState(todayIso());
  const [rmssd, setRmssd] = useState("");
  const [restingHr, setRestingHr] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [sleepQuality, setSleepQuality] = useState<Likert>();
  const [soreness, setSoreness] = useState<Likert>();
  const [fatigue, setFatigue] = useState<Likert>();
  const [stress, setStress] = useState<Likert>();
  const [motivation, setMotivation] = useState<Likert>();
  const [sessionLoad, setSessionLoad] = useState("");
  const [result, setResult] = useState<ReadinessResult | null>(null);

  const draft: DailyEntry = useMemo(
    () => ({
      date,
      rmssd: numOrUndef(rmssd),
      restingHr: numOrUndef(restingHr),
      sleepHours: numOrUndef(sleepHours),
      sleepQuality,
      soreness,
      fatigue,
      stress,
      motivation,
      sessionLoad: numOrUndef(sessionLoad),
    }),
    [date, rmssd, restingHr, sleepHours, sleepQuality, soreness, fatigue, stress, motivation, sessionLoad],
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updated = saveEntry(draft);
    setEntries(updated);
    setResult(recommend(toEngineInput(draft, updated)));
    // Share today's wellness with the coach server so chat/plan use it too.
    void postWellness(draft).catch(() => {});
  }

  return (
    <div className="layout">
      <form className="card form" onSubmit={onSubmit}>
        <h2>Daily check-in</h2>
        <p className="muted small">Shares your recovery with the coach, so its advice uses how you feel today.</p>

        <label className="field">
          <span className="field-label">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <div className="grid2">
          <label className="field">
            <span className="field-label">HRV (rMSSD, ms)</span>
            <span className="field-hint">morning reading, optional</span>
            <input inputMode="decimal" value={rmssd} onChange={(e) => setRmssd(e.target.value)} placeholder="e.g. 55" />
          </label>
          <label className="field">
            <span className="field-label">Resting HR (bpm)</span>
            <span className="field-hint">morning reading, optional</span>
            <input inputMode="decimal" value={restingHr} onChange={(e) => setRestingHr(e.target.value)} placeholder="e.g. 50" />
          </label>
          <label className="field">
            <span className="field-label">Sleep (hours)</span>
            <span className="field-hint">last night</span>
            <input inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} placeholder="e.g. 7.5" />
          </label>
          <label className="field">
            <span className="field-label">Training load today</span>
            <span className="field-hint">TSS/TRIMP, optional</span>
            <input inputMode="decimal" value={sessionLoad} onChange={(e) => setSessionLoad(e.target.value)} placeholder="e.g. 60" />
          </label>
        </div>

        <LikertField label="Sleep quality" hint="1 poor · 5 great" value={sleepQuality} onChange={setSleepQuality} />
        <LikertField label="Soreness" hint="1 none · 5 severe" value={soreness} onChange={setSoreness} />
        <LikertField label="Fatigue" hint="1 fresh · 5 exhausted" value={fatigue} onChange={setFatigue} />
        <LikertField label="Stress" hint="1 calm · 5 very stressed" value={stress} onChange={setStress} />
        <LikertField label="Motivation" hint="1 none · 5 high" value={motivation} onChange={setMotivation} />

        <button type="submit" className="submit">Get recommendation</button>
      </form>

      <section className="result-col">
        {result ? <ResultCard result={result} /> : <EmptyResult />}
        <HistoryList entries={entries} />
      </section>
    </div>
  );
}

function ResultCard({ result }: { result: ReadinessResult }) {
  const tone = result.recommendation.toLowerCase().replace("_", "-");
  return (
    <div className={`card result tone-${tone}`}>
      <div className="result-head">
        <div>
          <span className="result-kicker">Today's call</span>
          <h2 className="result-rec">{REC_LABEL[result.recommendation]}</h2>
        </div>
        <div className="score-ring" aria-label={`Readiness ${result.readinessScore} of 100`}>
          <span className="score-num">{result.readinessScore}</span>
          <span className="score-unit">/100</span>
        </div>
      </div>

      <span className={`confidence conf-${result.confidence.toLowerCase()}`}>
        {result.confidence} confidence
      </span>

      <ul className="drivers">
        {result.drivers.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>

      <div className="subscores">
        {(
          [
            ["HRV", result.subScores.hrv],
            ["Resting HR", result.subScores.rhr],
            ["Sleep", result.subScores.sleep],
            ["Subjective", result.subScores.subjective],
            ["Form", result.subScores.form],
          ] as const
        )
          .filter(([, v]) => v !== undefined)
          .map(([label, v]) => (
            <div className="subscore" key={label}>
              <div className="subscore-top">
                <span>{label}</span>
                <span>{v}</span>
              </div>
              <div className="bar">
                <div className="bar-fill" style={{ width: `${v}%` }} />
              </div>
            </div>
          ))}
      </div>

      <div className="metrics">
        <span>CTL {result.metrics.ctl.toFixed(1)}</span>
        <span>ATL {result.metrics.atl.toFixed(1)}</span>
        <span>TSB {result.metrics.tsb.toFixed(1)}</span>
        {result.metrics.acwr !== undefined && <span>ACWR {result.metrics.acwr.toFixed(2)}</span>}
      </div>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="card result empty">
      <p>Fill in today's check-in and get your recommendation. Entries are saved on this device only.</p>
    </div>
  );
}

function HistoryList({ entries }: { entries: DailyEntry[] }) {
  if (entries.length === 0) return null;
  const recent = [...entries].reverse().slice(0, 7);
  return (
    <div className="card history">
      <h3>Recent entries</h3>
      <ul>
        {recent.map((e) => (
          <li key={e.date}>
            <span>{e.date}</span>
            <span className="history-meta">
              {e.rmssd ? `HRV ${e.rmssd}` : "—"} · {e.sleepHours ? `${e.sleepHours}h` : "—"} ·{" "}
              {e.sessionLoad ? `load ${e.sessionLoad}` : "rest"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
