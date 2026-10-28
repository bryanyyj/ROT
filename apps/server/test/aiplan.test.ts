import { describe, expect, it } from "vitest";
import { PlanStripper, mergeAiPlan, overlayAiPlan, parsePlan } from "../src/aiplan.js";

const TODAY = "2026-10-28";
const JSON_PLAN = '[{"date":"2026-10-31","sport":"cycling","title":"Long ride","intensity":"long","durationMin":180,"note":"Aerobic volume"}]';

function strip(chunks: string[]) {
  const s = new PlanStripper();
  let out = chunks.map((c) => s.feed(c)).join("");
  const { tail, json } = s.end();
  return { text: out + tail, json };
}

describe("PlanStripper", () => {
  it("hides the plan block and captures its JSON, even split across chunks", () => {
    const text = `Here you go.\n<plan>${JSON_PLAN}</plan>`;
    for (const size of [1, 3, 7, 1000]) {
      const chunks = text.match(new RegExp(`[^]{1,${size}}`, "g"))!;
      const r = strip(chunks);
      expect(r.text).toBe("Here you go.\n");
      expect(r.json).toBe(JSON_PLAN);
    }
  });
  it("passes through ordinary text, including a stray '<'", () => {
    expect(strip(["Keep HR < 140 and <b", "e easy"]).text).toBe("Keep HR < 140 and <be easy");
  });
  it("flushes a held partial tag at the end of the stream", () => {
    expect(strip(["Easy day <pl"]).text).toBe("Easy day <pl");
  });
});

describe("parsePlan", () => {
  it("normalises valid sessions", () => {
    const [s] = parsePlan(JSON_PLAN, TODAY);
    expect(s).toMatchObject({ date: "2026-10-31", sport: "Ride", intensity: "long", durationMin: 180, rationale: "Aerobic volume" });
  });
  it("drops malformed, past and far-future entries", () => {
    expect(parsePlan("not json", TODAY)).toEqual([]);
    const bad = '[{"date":"2026-10-01","sport":"Run"},{"date":"2027-06-01","sport":"Run"},{"date":"nope"},null,{"date":"2026-10-30","sport":"Run","durationMin":9999,"intensity":"bogus"}]';
    const out = parsePlan(bad, TODAY);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ intensity: "easy", durationMin: 480 });
  });
  it("gives rest days zero duration and unique ids for doubles", () => {
    const out = parsePlan('[{"date":"2026-10-30","intensity":"rest"},{"date":"2026-10-31","sport":"Run"},{"date":"2026-10-31","sport":"Run"}]', TODAY);
    expect(out[0]).toMatchObject({ durationMin: 0, title: "Rest" });
    expect(new Set(out.map((s) => s.id)).size).toBe(3);
  });
});

describe("calendar merging", () => {
  const mk = (date: string, id: string) => ({ id, date, sport: "Run", title: "t", intensity: "easy" as const, durationMin: 30, rationale: "" });
  it("replaces stored sessions on re-planned dates and prunes past ones", () => {
    const merged = mergeAiPlan([mk("2026-10-01", "old"), mk("2026-10-30", "a"), mk("2026-11-01", "b")], [mk("2026-10-30", "new")], TODAY);
    expect(merged.map((s) => s.id)).toEqual(["new", "b"]);
  });
  it("lets coach sessions override the default week only on their dates", () => {
    const out = overlayAiPlan([mk("2026-10-29", "x"), mk("2026-10-30", "y")], [mk("2026-10-30", "ai")], TODAY);
    expect(out.map((s) => s.id)).toEqual(["x", "ai"]);
  });
});
