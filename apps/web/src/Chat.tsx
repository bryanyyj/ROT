import { useEffect, useRef, useState } from "react";
import { streamChat, getStatus, type ChatMessage } from "./api.js";
import { SendIcon } from "./icons.js";

const SUGGESTIONS = [
  "Should I train hard today?",
  "Plan my week around a long ride Saturday",
  "I feel flat — adjust today's session",
  "How's my form looking?",
];

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getStatus()
      .then((s) => {
        setLlmReady(s.openRouter.configured);
        setModel(s.openRouter.model);
      })
      .catch(() => setLlmReady(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function autoGrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    requestAnimationFrame(autoGrow);
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
          content: `I couldn't reach the coaching model. ${e instanceof Error ? e.message : ""}`.trim(),
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="chat-view">
      <div className="chat-scroll" ref={scrollRef}>
        {empty ? (
          <div className="chat-hero">
            <h1 className="chat-hero-title">Ready to train?</h1>
            <p className="chat-hero-sub">
              Ask your coach anything — it reads your training data and form, and adjusts the plan with you.
            </p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion" disabled={llmReady === false} onClick={() => send(s)}>
                  {s}
                </button>
              ))}
            </div>
            {llmReady === false && (
              <p className="chat-note">
                Add <code>OPENROUTER_API_KEY</code> to <code>apps/server/.env</code> and restart the API to start chatting.
              </p>
            )}
          </div>
        ) : (
          <div className="chat-thread">
            {messages.map((m, i) => (
              <div key={i} className={`bubble-row ${m.role}`}>
                <div className={`bubble ${m.role}`}>
                  {m.content || <span className="typing"><i /><i /><i /></span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="composer">
        <div className="composer-inner">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            disabled={llmReady === false || busy}
            placeholder={llmReady === false ? "Coach offline — configure OpenRouter" : "Message your coach…"}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
          />
          <button
            className="send"
            aria-label="Send message"
            disabled={llmReady === false || busy || input.trim() === ""}
            onClick={() => send(input)}
          >
            <SendIcon />
          </button>
        </div>
        {model && llmReady && <span className="composer-model">{model}</span>}
      </div>
    </div>
  );
}
