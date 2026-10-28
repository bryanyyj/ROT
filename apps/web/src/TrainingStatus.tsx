import { useState } from "react";
import type { FormPoint } from "./api.js";

/** Form (TSB) bands, bottom to top. Boundaries are the thresholds shown on the chart axis. */
const ZONES = [
  { name: "Overtraining Risk", below: -30, color: "#f43f5e" },
  { name: "Gaining Fitness", below: -10, color: "#22c55e" },
  { name: "Maintaining", below: 5, color: "#e5e7eb" },
  { name: "Fresh", below: 20, color: "#38bdf8" },
  { name: "Detraining", below: Infinity, color: "#f59e0b" },
] as const;
const THRESHOLDS = [-30, -10, 5, 20];

export const formZone = (tsb: number) => ZONES.find((z) => tsb < z.below)!;

const RANGES = [{ label: "3 months", days: 91 }, { label: "6 months", days: 183 }, { label: "1 year", days: 366 }] as const;

const W = 340;
const bounds = (points: FormPoint[]) => ({
  lo: Math.min(-45, ...points.map((p) => p.tsb - 3)),
  hi: Math.max(30, ...points.map((p) => p.tsb + 3)),
});

/** Splits each step where it crosses a band edge so the line changes colour exactly there. */
function segments(points: FormPoint[], x: (i: number) => number, y: (v: number) => number) {
  const out: { d: string; color: string }[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!.tsb, b = points[i]!.tsb;
    const cuts = THRESHOLDS.filter((t) => (a < t) !== (b < t)).map((t) => (t - a) / (b - a)).sort((p, q) => p - q);
    const stops = [0, ...cuts, 1];
    for (let s = 1; s < stops.length; s++) {
      const t0 = stops[s - 1]!, t1 = stops[s]!;
      const v = (t: number) => a + (b - a) * t;
      const px = (t: number) => x(i - 1) + (x(i) - x(i - 1)) * t;
      out.push({ d: `M${px(t0).toFixed(1)} ${y(v(t0)).toFixed(1)}L${px(t1).toFixed(1)} ${y(v(t1)).toFixed(1)}`, color: formZone(v((t0 + t1) / 2)).color });
    }
  }
  return out;
}

const DAY = 86400000;
const dayMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

/** The x axis always spans `windowDays` ending on the latest day, so a longer range compresses the line. */
function FormChart({ points: all, windowDays, compact }: { points: FormPoint[]; windowDays: number; compact?: boolean }) {
  const H = compact ? 84 : 250;
  const endMs = dayMs(all.at(-1)!.date);
  const startMs = endMs - (windowDays - 1) * DAY;
  const points = all.filter((p) => dayMs(p.date) >= startMs);
  const { lo, hi } = bounds(points);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const xs = points.map((p) => ((dayMs(p.date) - startMs) / DAY / (windowDays - 1)) * W);
  const x = (i: number) => xs[i]!;
  const edges = [lo, ...THRESHOLDS, hi];
  const step = windowDays > 200 ? 2 : 1;
  const months = compact ? [] : Array.from({ length: windowDays }, (_, d) => new Date(startMs + d * DAY).toISOString().slice(0, 10))
    .flatMap((date, d) => date.endsWith("-01") ? [{ d, date }] : [])
    .filter((_, k, list) => (list.length - 1 - k) % step === 0)
    .filter(({ d }) => d / (windowDays - 1) < 0.94);
  return (
    <div className={`form-chart ${compact ? "is-compact" : ""}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Form over time, coloured by training status zone">
        {ZONES.map((z, k) => <rect key={z.name} x="0" width={W} y={y(edges[k + 1]!)} height={y(edges[k]!) - y(edges[k + 1]!)} fill={z.color} opacity="0.1" />)}
        {THRESHOLDS.map((t) => <line key={t} x1="0" x2={W} y1={y(t)} y2={y(t)} stroke="currentColor" opacity="0.18" vectorEffect="non-scaling-stroke" />)}
        {segments(points, x, y).map((s, i) => <path key={i} d={s.d} stroke={s.color} fill="none" strokeWidth={compact ? 1.6 : 2.2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />)}
      </svg>
      {!compact && <>
        <div className="form-zone-labels" aria-hidden="true">
          {ZONES.map((z, k) => <span key={z.name} style={{ top: `${(y(edges[k + 1]!) + y(edges[k]!)) / 2 / H * 100}%`, color: z.color }}>{z.name}</span>)}
        </div>
        <div className="form-ticks" aria-hidden="true">
          {THRESHOLDS.map((t) => <span key={t} style={{ top: `${y(t) / H * 100}%` }}>{t > 0 ? `+${t}` : t}</span>)}
        </div>
        <div className="form-months" aria-hidden="true">
          {months.map(({ d, date }) => <span key={date} style={{ left: `${d / (windowDays - 1) * 100}%` }}>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>)}
        </div>
      </>}
    </div>
  );
}

const EMPTY = "Not enough history yet. Status appears after a few weeks of synced training.";

/** Half-width card on the Profile: status first, chart preview beneath. */
export function TrainingStatusCard({ points, onOpen }: { points: FormPoint[] | null; onOpen: () => void }) {
  const last = points?.at(-1);
  const zone = last ? formZone(last.tsb) : undefined;
  return (
    <button type="button" className="card status-card status-open" onClick={onOpen} aria-label="Open training status details">
      <span className="result-kicker">Training status</span>
      <span className="status-value" style={{ color: zone?.color }}>{zone?.name ?? "—"}</span>
      {points && points.length > 1 ? <FormChart points={points} windowDays={91} compact /> : <span className="status-sub">{points ? "Not enough history yet." : "Loading…"}</span>}
    </button>
  );
}

export function TrainingStatusDetail({ points, onBack }: { points: FormPoint[]; onBack: () => void }) {
  const [days, setDays] = useState<number>(RANGES[0].days);
  const last = points.at(-1);
  const zone = last ? formZone(last.tsb) : undefined;
  return (
    <section className="status-detail" aria-labelledby="status-detail-title">
      <button type="button" className="text-btn back-btn" onClick={onBack}>‹ Profile</button>
      <div className="range-tabs" role="tablist" aria-label="Time range">
        {RANGES.map((r) => (
          <button key={r.label} type="button" role="tab" aria-selected={days === r.days} className={days === r.days ? "on" : ""} onClick={() => setDays(r.days)}>{r.label}</button>
        ))}
      </div>
      <h2 id="status-detail-title" className="status-detail-title">Training Status: <span style={{ color: zone?.color }}>{zone?.name ?? "—"}</span></h2>
      {points.length > 1 ? <FormChart points={points} windowDays={days} /> : <p className="muted">{EMPTY}</p>}
      <p className="muted small">Form is fitness minus fatigue (CTL − ATL) from your synced training. Early days are skipped while the model warms up.</p>
    </section>
  );
}
