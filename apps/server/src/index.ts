import express from "express";
import { config, hasOpenRouter, hasStrava } from "./config.js";
import { store } from "./store.js";
import {
  buildContext,
  contextMessage,
  planWeek,
  pastSessions,
  COACH_SYSTEM,
  WEEKLY_PLAN_PROMPT,
} from "./coach.js";
import { streamChat, completeChat, type LlmMessage } from "./openrouter.js";
import { authorizeUrl, exchangeCode, syncActivities } from "./strava.js";
import { GARMIN_STATUS } from "./garmin.js";
import type { Activity, ChatMessage, Wellness } from "./types.js";

const app = express();
app.use(express.json({ limit: "2mb" }));

// Permissive CORS (dev). In prod, lock to WEB_ORIGIN.
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", config.webOrigin);
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/status", (_req, res) => {
  res.json({
    openRouter: { configured: hasOpenRouter(), model: config.openRouter.model },
    strava: { configured: hasStrava(), connected: !!store.getStrava() },
    garmin: GARMIN_STATUS,
    source: store.getSource(),
    activities: store.getActivities().length,
  });
});

app.get("/api/context", (_req, res) => {
  const ctx = buildContext(store.getActivities(), store.getWellness());
  res.json({
    readiness: ctx.readiness,
    recent: ctx.recent,
    weekLoad: ctx.weekLoad,
    source: store.getSource(),
    totalActivities: ctx.totalActivities,
  });
});

app.get("/api/week", (_req, res) => {
  const activities = store.getActivities();
  const ctx = buildContext(activities, store.getWellness());
  const hasData = activities.length > 0;
  res.json({
    planned: hasData ? planWeek(ctx, activities) : [],
    past: pastSessions(activities),
    readiness: ctx.readiness,
    source: store.getSource(),
  });
});

app.post("/api/wellness", (req, res) => {
  const w = req.body as Wellness;
  store.setWellness({ ...w, date: w.date ?? new Date().toISOString().slice(0, 10) });
  res.json({ ok: true });
});

app.post("/api/import", (req, res) => {
  const activities = (req.body?.activities ?? []) as Activity[];
  if (!Array.isArray(activities) || activities.length === 0) {
    return res.status(400).json({ error: "Provide a non-empty 'activities' array." });
  }
  store.setActivities(
    activities.map((a) => ({ ...a, source: "import" as const })),
    "import",
  );
  res.json({ ok: true, count: activities.length });
});

function buildMessages(ctx: ReturnType<typeof buildContext>, history: ChatMessage[]): LlmMessage[] {
  return [
    { role: "system", content: `${COACH_SYSTEM}\n\n${contextMessage(ctx)}` },
    ...history.map((m) => ({ role: m.role, content: m.content }) as LlmMessage),
  ];
}

app.post("/api/chat", async (req, res) => {
  if (!hasOpenRouter()) {
    return res.status(400).json({
      error: "OpenRouter not configured. Set OPENROUTER_API_KEY in apps/server/.env.",
    });
  }
  const history = (req.body?.messages ?? []) as ChatMessage[];
  const ctx = buildContext(store.getActivities(), store.getWellness());
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  try {
    for await (const delta of streamChat(buildMessages(ctx, history))) {
      res.write(delta);
    }
    res.end();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM error";
    if (!res.headersSent) res.status(502).json({ error: msg });
    else res.end(`\n\n[error: ${msg}]`);
  }
});

app.post("/api/plan", async (req, res) => {
  if (!hasOpenRouter()) {
    return res.status(400).json({ error: "OpenRouter not configured. Set OPENROUTER_API_KEY." });
  }
  const ctx = buildContext(store.getActivities(), store.getWellness());
  try {
    const plan = await completeChat([
      { role: "system", content: `${COACH_SYSTEM}\n\n${contextMessage(ctx)}` },
      { role: "user", content: WEEKLY_PLAN_PROMPT },
    ]);
    res.json({ plan });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : "LLM error" });
  }
});

// ---- Strava OAuth ----
app.get("/api/strava/connect", (_req, res) => {
  if (!hasStrava()) {
    return res.status(400).send("Strava not configured. Set STRAVA_CLIENT_ID/SECRET in apps/server/.env.");
  }
  res.redirect(authorizeUrl());
});

app.get("/api/strava/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) return res.redirect(`${config.webOrigin}/?strava=error`);
  try {
    await exchangeCode(code);
    const activities = await syncActivities();
    res.redirect(`${config.webOrigin}/?strava=connected&count=${activities.length}`);
  } catch (err) {
    const msg = encodeURIComponent(err instanceof Error ? err.message : "error");
    res.redirect(`${config.webOrigin}/?strava=error&msg=${msg}`);
  }
});

app.post("/api/strava/sync", async (_req, res) => {
  try {
    const activities = await syncActivities();
    res.json({ ok: true, count: activities.length });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "sync failed" });
  }
});

app.listen(config.port, () => {
  console.log(`[rot-server] listening on http://localhost:${config.port}`);
  console.log(`[rot-server] OpenRouter: ${hasOpenRouter() ? config.openRouter.model : "NOT configured"}`);
  console.log(`[rot-server] Strava: ${hasStrava() ? "configured" : "NOT configured"}`);
});
