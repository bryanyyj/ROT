import { useState, type ComponentType } from "react";
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

  return (
    <div className="shell">
      <main className="shell-main">
        {tab === "calendar" && <Calendar />}
        {tab === "chat" && <Chat />}
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
