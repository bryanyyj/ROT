import { useState } from "react";
import { Coach } from "./Coach.js";
import { CheckIn } from "./CheckIn.js";

type Tab = "coach" | "checkin";

export function App() {
  const [tab, setTab] = useState<Tab>("coach");

  return (
    <div className="app">
      <header className="header">
        <h1>
          Ready<span className="accent">or</span>Rest
        </h1>
        <p className="tagline">
          An AI endurance coach that reads your training data and tells you whether to train hard, go
          easy, or rest — then plans your week.
        </p>
        <nav className="tabs">
          <button className={tab === "coach" ? "tab on" : "tab"} onClick={() => setTab("coach")}>
            Coach
          </button>
          <button className={tab === "checkin" ? "tab on" : "tab"} onClick={() => setTab("checkin")}>
            Daily check-in
          </button>
        </nav>
      </header>

      <main>{tab === "coach" ? <Coach /> : <CheckIn />}</main>

      <footer className="footer">
        Original, independent build. Decision engine uses public sports-science methods (CTL/ATL/TSB,
        ACWR, HRV-guided training); the coach is grounded by that engine via OpenRouter. Not affiliated
        with any app. Guidance only — not medical advice.
      </footer>
    </div>
  );
}
