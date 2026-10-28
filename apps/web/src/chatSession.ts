import { useCallback, useRef, useState } from "react";
import { getWorkoutProfile, reviewWorkout, streamChat, type ChatMessage, type WorkoutAttachment } from "./api.js";
import { sportNoun } from "./workoutMetrics.js";

/** Chat history lives above the tabs so a workout review can start from the calendar and survive tab changes. */
export function useChatSession() {
  const [messages, setMessagesState] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const messagesRef = useRef<ChatMessage[]>([]);
  const busyRef = useRef(false);

  const setMessages = useCallback((update: (prev: ChatMessage[]) => ChatMessage[]) => {
    messagesRef.current = update(messagesRef.current);
    setMessagesState(messagesRef.current);
  }, []);
  const patch = useCallback((index: number, change: Partial<ChatMessage>) =>
    setMessages((prev) => prev.map((m, i) => i === index ? { ...m, ...change } : m)), [setMessages]);
  const run = useCallback(async (task: () => Promise<void>) => {
    busyRef.current = true;
    setBusy(true);
    try { await task(); } finally { busyRef.current = false; setBusy(false); }
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busyRef.current) return;
    const history: ChatMessage[] = [...messagesRef.current, { role: "user", content }];
    const index = history.length;
    setMessages(() => [...history, { role: "assistant", content: "" }]);
    await run(async () => {
      try {
        await streamChat(history, (delta) => setMessages((prev) => prev.map((m, i) => i === index ? { ...m, content: m.content + delta } : m)));
      } catch (e) {
        patch(index, { content: `I couldn't reach the coaching model. ${e instanceof Error ? e.message : ""}`.trim() });
      }
    });
  }, [patch, run, setMessages]);

  const review = useCallback(async (workout: WorkoutAttachment) => {
    if (busyRef.current) return;
    const { session, completed } = workout;
    const index = messagesRef.current.length;
    setMessages((prev) => [...prev,
      { role: "user", content: `Review this ${completed ? "" : "planned "}${sportNoun(session.sport)}.`, workout },
      { role: "assistant", content: "", workout, review: true }]);
    await run(async () => {
      try {
        const [profile, text] = await Promise.all([
          completed ? getWorkoutProfile(session.id).catch(() => null) : Promise.resolve(null),
          reviewWorkout(completed ? { activityId: session.id } : { plannedId: session.id }),
        ]);
        const attached = { ...workout, profile };
        patch(index, { workout: attached });
        patch(index + 1, { content: text, workout: attached });
      } catch (e) {
        patch(index + 1, { content: e instanceof Error ? e.message : "Review failed. Please try again.", review: false });
      }
    });
  }, [patch, run, setMessages]);

  return { messages, busy, send, review };
}
