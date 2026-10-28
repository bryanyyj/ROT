import { useCallback, useState, type ComponentType } from "react";
import { useChatSession } from "./chatSession.js";
import { ReviewContext } from "./reviewContext.js";
import type { WorkoutAttachment } from "./api.js";
import { Chat } from "./Chat.js";
import { Calendar } from "./Calendar.js";
import { Profile } from "./Profile.js";
import { CalendarIcon, ChatIcon, ProfileIcon } from "./icons.js";

type Tab = "calendar" | "chat" | "profile";

const TABS: Array<{ id: Tab; label: string; Icon: ComponentType<{ size?: number }> }> = [
  { id: "calendar", label: "Calendar", Icon: CalendarIcon },
  { id: "chat", label: "Chat", Icon: ChatIcon },
  { id: "profile", label: "Profile", Icon: ProfileIcon },
];

export function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const chat = useChatSession();
  const { review } = chat;
  // Reviews always happen in the chat, so jump there before the answer streams in.
  const startReview = useCallback((workout: WorkoutAttachment) => { setTab("chat"); void review(workout); }, [review]);

  return (
    <div className="shell">
      <main className="shell-main">
        <ReviewContext.Provider value={startReview}>
          {tab === "calendar" && <Calendar />}
        </ReviewContext.Provider>
        {tab === "chat" && <Chat messages={chat.messages} busy={chat.busy} send={chat.send} />}
        {tab === "profile" && <Profile />}
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`nav-btn ${tab === id ? "on" : ""}`}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
