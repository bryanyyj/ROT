import { useEffect, useState } from "react";
import { getTrainingSchedule, saveTrainingSchedule, type ScheduleContext, type TrainingSchedule, type TrainingSport } from "./api.js";

const SPORTS: { value: TrainingSport; label: string }[] = [{ value: "Swim", label: "Swim" }, { value: "Ride", label: "Bike" }, { value: "Run", label: "Run" }];
const sportLabel = (sports: TrainingSport[]) => sports.map((s) => s === "Ride" ? "Bike" : s).join(" + ");

/** Days still on Auto with a suggested sport start out selected, so Save keeps them. */
const preselect = (data: ScheduleContext): TrainingSchedule["days"] =>
  data.saved.days.map((day, i) => day ?? (data.days[i]!.suggestedSports.length ? data.days[i]!.suggestedSports : null));

export function TrainingWeek() {
  const [context, setContext] = useState<ScheduleContext | null>(null);
  const [days, setDays] = useState<TrainingSchedule["days"]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    getTrainingSchedule().then((data) => { if (active) { setContext(data); setDays(preselect(data)); } }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [attempt]);

  function change(index: number, sports: TrainingSport[] | null) {
    setDays((current) => current.map((day, i) => i === index ? sports : day));
    setSaved(false);
  }
  function toggleSport(index: number, sport: TrainingSport) {
    const current = days[index] ?? context!.days[index]!.suggestedSports;
    change(index, current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport]);
  }
  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const result = await saveTrainingSchedule(days);
      setContext(result); setDays(preselect(result)); setSaved(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save your training week."); }
    finally { setSaving(false); }
  }
  return <section className="card training-week" aria-labelledby="training-week-title">
    <h2 id="training-week-title">Your training week</h2>
    <p className="muted small">Choose your regular sports once. Your coach will keep these days and adjust the intensity and duration. Choose more than one sport for doubles or bricks.</p>
    {!context && !error && <p role="status" className="muted small">Loading your weekly pattern…</p>}
    {context && <>
      <p className="schedule-note">Auto uses recurring patterns from your synced history ({context.weeksObserved} weeks). Suggestions aren’t fixed commitments.</p>
      <div className="schedule-days">
        {context.days.map((day, index) => {
          const explicit = days[index];
          const automatic = explicit === null;
          const effective = explicit ?? day.suggestedSports;
          return <fieldset key={day.weekday} className="schedule-day" disabled={saving}>
            <legend>{day.weekday}</legend>
            <div className="schedule-options">
              {SPORTS.map(({ value, label }) => <button type="button" key={value} className={`schedule-choice ${!automatic && effective.includes(value) ? "selected" : ""}`} aria-pressed={!automatic && effective.includes(value)} onClick={() => toggleSport(index, value)}>{label}</button>)}
              <button type="button" className={`schedule-choice ${!automatic && effective.length === 0 ? "selected" : ""}`} aria-pressed={!automatic && effective.length === 0} onClick={() => change(index, [])}>Rest</button>
              <button type="button" className={`schedule-choice ${automatic ? "selected" : ""}`} aria-pressed={automatic} onClick={() => change(index, null)}>Auto</button>
            </div>
            <p className="schedule-hint">{automatic ? effective.length ? `Suggested: ${sportLabel(effective)} · ${effective.map((sport) => `${sport === "Ride" ? "Bike" : sport} ${day.evidence[sport]}/${context.weeksObserved} weeks`).join(", ")}` : "No consistent pattern yet. Choose your sports above." : effective.length ? `${sportLabel(effective)} · fixed day` : "Rest · fixed day"}</p>
          </fieldset>;
        })}
      </div>
      <button className="btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save training week"}</button>
      {saved && <p className="schedule-saved" role="status">Saved. Your coach will use this week in future chats and plans.</p>}
    </>}
    {error && <p className="flash err" role="alert">{error}{!context && <> <button className="text-btn" onClick={() => setAttempt(attempt + 1)}>Retry</button></>}</p>}
  </section>;
}
