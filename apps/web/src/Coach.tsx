import { useEffect, useRef, useState } from "react";
import {
  getStatus,
  getContext,
  getPlan,
  streamChat,
  connectStrava,
  type Status,
  type CoachContext,
  type ChatMessage,
} from "./api.js";

const REC_LABEL: Record<string, string> = {
  TRAIN_HARD: "Train hard",
  TRAIN_EASY: "Go easy",
  REST: "Rest",
};

export function Coach() {
  const [status, setStatus] = useState<Status | null>(null);
  const [ctx, setCtx] = useState<CoachContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStatus().then(setStatus).catch(() => {});
    getContext().then(setCtx).catch(() => setError("Could not reach the coach server. Is it running?"));
  }, []);

  const params = new URLSearchParams(window.location.search);
  const stravaFlash = params.get("strava");

  return (
    <div className="coach">
      {stravaFlash === "connected" && (
        <div className="flash ok">Strava connected — {params.get("count")} activities imported.</div>
      )}
      {stravaFlash === "error" && <div className="flash err">Strava connection failed.</div>}
      {error && <div className="flash err">{error}</div>}

      <StatusBar status={status} />
      {ctx && <ReadinessSummary ctx={ctx} />}
      <div className="coach-grid">
        <ChatPanel disabled={!status?.openRouter.configured} />
        <PlanPanel disabled={!status?.openRouter.configured} />
      </div>
    </div>
  );
}

function StatusBar({ status }: { status: Status | null }) {
  if (!status) return <div className="card statusbar">Connecting to coach…</div>;
  return (
    <div className="card statusbar">
      <div className="status-items">
        <span className="status-chip">
          Data: <strong>{status.source}</strong> ({status.activities})
        </span>
        <span className={`status-chip ${status.openRouter.configured ? "on" : "off"}`}>
          LLM: {status.openRouter.configured ? status.openRouter.model : "not configured"}
        </span>
        <span className={`status-chip ${status.strava.connected ? "on" : status.strava.configured ? "" : "off"}`}>
          Strava: {status.strava.connected ? "connected" : status.strava.configured ? "ready" : "not set up"}
        </span>
      </div>
      <div className="status-actions">
        {status.strava.configured && !status.strava.connected && (
          <button className="btn-sm" onClick={connectStrava}>Connect Strava</button>
        )}
      </div>
      {!status.openRouter.configured && (
        <p className="status-note">
          Add <code>OPENROUTER_API_KEY</code> to <code>apps/server/.env</code> to enable the chat and plan.
        </p>
      )}
    </div>
  );
}

function ReadinessSummary({ ctx }: { ctx: CoachContext }) {
  const r = ctx.readiness;
  const tone = r.recommendation.toLowerCase().replace("_", "-");
  return (
    <div className={`card readiness tone-${tone}`}>
      <div className="readiness-head">
        <div>
          <span className="result-kicker">Engine readiness (from your data)</span>
          <h2 className="result-rec">{REC_LABEL[r.recommendation]}</h2>
        </div>
        <div className="score-ring">
          <span className="score-num">{r.readinessScore}</span>
          <span className="score-unit">/100</span>
        </div>
      </div>
      <div className="metrics">
        <span>CTL {r.metrics.ctl.toFixed(0)}</span>
        <span>ATL {r.metrics.atl.toFixed(0)}</span>
        <span>TSB {r.metrics.tsb.toFixed(0)}</span>
        {r.metrics.acwr !== undefined && <span>ACWR {r.metrics.acwr.toFixed(2)}</span>}
        <span>7-day load {ctx.weekLoad}</span>
      </div>
      <ul className="drivers">{r.drivers.map((d, i) => <li key={i}>{d}</li>)}</ul>
    </div>
  );
}

function ChatPanel({ disabled }: { disabled: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    try {
      await streamChat(history, (delta) => {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1]!;
          copy[copy.length - 1] = { ...last, content: last.content + delta };
          return copy;
        });
      });
    } catch (e) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `⚠️ ${e instanceof Error ? e.message : "chat failed"}`,
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card chat">
      <h3>Ask your coach</h3>
      <div className="chat-log">
        {messages.length === 0 && (
          <p className="muted">
            {disabled
              ? "Set up OpenRouter to chat."
              : "e.g. “Should I do intervals today?” or “Plan my recovery week.”"}
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            <span className="msg-role">{m.role === "user" ? "You" : "Coach"}</span>
            <div className="msg-body">{m.content || "…"}</div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="chat-input">
        <textarea
          value={input}
          disabled={disabled || busy}
          placeholder={disabled ? "OpenRouter not configured" : "Message your coach…"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="submit" disabled={disabled || busy} onClick={send}>
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}

function PlanPanel({ disabled }: { disabled: boolean }) {
  const [plan, setPlan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function generate() {
    setBusy(true);
    setErr("");
    try {
      setPlan(await getPlan());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "plan failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card plan">
      <div className="plan-head">
        <h3>Weekly plan</h3>
        <button className="btn-sm" disabled={disabled || busy} onClick={generate}>
          {busy ? "Generating…" : "Generate"}
        </button>
      </div>
      {err && <div className="flash err">{err}</div>}
      {plan ? (
        <pre className="plan-text">{plan}</pre>
      ) : (
        <p className="muted">
          {disabled ? "Set up OpenRouter to generate a plan." : "Generate a 7-day plan from your current form."}
        </p>
      )}
    </div>
  );
}
