import { useEffect, useRef, useState } from "react";
import { getStatus, type ChatMessage } from "./api.js";
import { ReviewReply, WorkoutChip } from "./WorkoutChat.js";
import { SendIcon } from "./icons.js";
import { CoachText } from "./CoachText.js";

const SUGGESTIONS = [
  "Should I train hard today?",
  "Plan my week around a long ride Saturday",
  "I feel flat — adjust today's session",
  "How's my form looking?",
];

export function Chat({ messages, busy, send }: { messages: ChatMessage[]; busy: boolean; send: (text: string) => Promise<void> }) {
  const [input, setInput] = useState("");
  const [llmReady, setLlmReady] = useState<boolean | null>(null);
  const [model, setModel] = useState("");
  const [free, setFree] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getStatus()
      .then((s) => {
        setLlmReady(s.openRouter.configured);
        setModel(s.openRouter.model);
        setFree(!!s.openRouter.free);
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

  function submit(text: string) {
    if (!text.trim() || busy) return;
    setInput("");
    requestAnimationFrame(autoGrow);
    void send(text);
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
                <button key={s} className="suggestion" disabled={llmReady === false} onClick={() => submit(s)}>
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
                {m.role === "user" && m.workout ? (
                  <div className="review-request"><WorkoutChip workout={m.workout} /><div className="bubble user">{m.content}</div></div>
                ) : (
                  <div className={`bubble ${m.role}`}>
                    {!m.content ? <span className="typing"><i /><i /><i /></span>
                      : m.review && m.workout ? <ReviewReply content={m.content} workout={m.workout} />
                      : m.role === "assistant" ? <CoachText>{m.content}</CoachText> : m.content}
                  </div>
                )}
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
                submit(input);
              }
            }}
          />
          <button
            className="send"
            aria-label="Send message"
            disabled={llmReady === false || busy || input.trim() === ""}
            onClick={() => submit(input)}
          >
            <SendIcon />
          </button>
        </div>
        {model && llmReady && (
          <span className="composer-model">{model}{free ? " · free" : ""}</span>
        )}
      </div>
    </div>
  );
}
