import { useEffect, useState } from "react";
import { getAthlete, saveAthlete, type AthleteData } from "./api.js";

const pad = (n: number) => String(n).padStart(2, "0");
const formatPace = (sec: number) => `${Math.floor(sec / 60)}:${pad(Math.round(sec % 60))}`;

/** "4:30" → 270. Returns null for an empty field and undefined for an invalid one. */
function parsePace(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}
function parseNumber(text: string): number | null | undefined {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

export function AthleteCard() {
  const [data, setData] = useState<AthleteData | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ftp: "", pace: "", weight: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { getAthlete().then(setData).catch((e: Error) => setError(e.message)); }, []);

  function startEdit() {
    if (!data) return;
    setForm({
      ftp: data.ftp ? String(data.ftp.value) : "",
      pace: data.thresholdPaceSecKm ? formatPace(data.thresholdPaceSecKm.value) : "",
      weight: data.weightKg ? String(data.weightKg.value) : "",
    });
    setError("");
    setEditing(true);
  }

  async function save() {
    const ftp = parseNumber(form.ftp), pace = parsePace(form.pace), weight = parseNumber(form.weight);
    if (ftp === undefined || pace === undefined || weight === undefined) {
      setError(pace === undefined ? "Enter threshold pace as minutes:seconds, for example 4:30." : "Enter numbers only.");
      return;
    }
    setSaving(true); setError("");
    try {
      setData(await saveAthlete({ ftp, thresholdPaceSecKm: pace, weightKg: weight }));
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your athlete details."); }
    finally { setSaving(false); }
  }

  const stats: { label: string; value: string; unit: string; note?: string }[] = [
    { label: "FTP", value: data?.ftp ? String(Math.round(data.ftp.value)) : "—", unit: "W", note: data?.ftp?.source === "strava" ? "Strava" : undefined },
    { label: "Threshold pace", value: data?.thresholdPaceSecKm ? formatPace(data.thresholdPaceSecKm.value) : "—", unit: "/km" },
    { label: "Weight", value: data?.weightKg ? String(data.weightKg.value) : "—", unit: "kg", note: data?.weightKg?.source === "strava" ? "Strava" : undefined },
    { label: "HRV", value: data?.hrv ? String(Math.round(data.hrv.value)) : "—", unit: "ms", note: data?.hrv ? "Check-in" : undefined },
    { label: "Resting HR", value: data?.restingHr ? String(Math.round(data.restingHr.value)) : "—", unit: "bpm", note: data?.restingHr ? "Check-in" : undefined },
  ];

  return (
    <section className="card athlete" aria-labelledby="athlete-title">
      <div className="athlete-head">
        <h2 id="athlete-title">Athlete</h2>
        {data && !editing && <button className="text-btn" onClick={startEdit}>Edit</button>}
      </div>
      {!editing ? (
        <dl className="athlete-stats">
          {stats.map((s) => (
            <div key={s.label} className="athlete-stat">
              <dt>{s.label}</dt>
              <dd><strong>{s.value}</strong>{s.value !== "—" && <span>{s.unit}</span>}</dd>
              {s.note && <small>{s.note}</small>}
            </div>
          ))}
        </dl>
      ) : (
        <form className="athlete-form" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <label>FTP (W)<input inputMode="numeric" value={form.ftp} onChange={(e) => setForm({ ...form, ftp: e.target.value })} placeholder="e.g. 220" /></label>
          <label>Threshold pace (min:sec /km)<input inputMode="numeric" value={form.pace} onChange={(e) => setForm({ ...form, pace: e.target.value })} placeholder="e.g. 4:30" /></label>
          <label>Weight (kg)<input inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="e.g. 68" /></label>
          <p className="muted small">HRV and resting HR come from your daily check-in. Leave a field empty to clear it.</p>
          <div className="athlete-actions">
            <button type="submit" className="btn-sm" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" className="text-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
          </div>
        </form>
      )}
      {error && <p className="flash err" role="alert">{error}</p>}
    </section>
  );
}
