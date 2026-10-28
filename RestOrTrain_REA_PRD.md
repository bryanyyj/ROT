# PRD: RestOrTrain Reverse-Engineering & Reconstruction Project

**Owner:** Bryan Yeo (YEO)
**Executor:** Claude Code (or any compatible coding agent, see Section 4)
**Target repo:** https://github.com/bryanyyj/ROT.git
**Skill / tooling:** REA (Reverse Engineer Anything), `morluto/rea`, plus the optional REA Reconstruction Companion skill (`ShadowSwaps/REA-Reconstruction-Companion`)
**Document version:** 1.0, 27 Oct 2026

---

## 0. How to use this document

Paste or point Claude Code at this file as its standing instructions. Claude Code must:

1. Read this whole PRD before acting.
2. Work phase by phase (Section 7), stopping at each **CHECKPOINT** to report to the owner.
3. Keep all work inside the cloned `ROT` repository, on a feature branch, never directly on `main`.
4. Record every claim about how RestOrTrain works with evidence (Section 8). No evidence means the claim is marked `UNKNOWN`, not guessed.

---

## 1. Background and goal

**RestOrTrain** is the target application. The owner wants to understand how it works, then rebuild a version of it with similar logic in the `ROT` repository, using REA to drive an evidence-based investigation rather than guessing from screenshots.

**Primary goal:** produce (a) an evidence-backed behaviour specification of RestOrTrain, and (b) a working re-implementation in `ROT` whose core logic is behaviourally similar to the original, validated by tests.

**Secondary goal:** do all of this using a **free AI model first**, only escalating to a paid model for steps where the free model demonstrably fails (Section 4).

### 1.1 Non-goals

- Copying proprietary assets (logos, artwork, copyrighted text, trademarks, bundled datasets). Re-implement logic only. Use original branding and assets.
- Bypassing authentication, licensing, DRM or paywalls, or attacking any backend service.
- Collecting other users' data.
- Publishing or distributing the original app's code or binaries.

---

## 2. Authorisation and legal guardrails (must confirm before Phase 1)

Claude Code must ask the owner to confirm, in chat, and record the answer in `docs/00-scope.md`:

- [ ] The owner built, owns, or has written permission to analyse RestOrTrain. (If it is a third-party app, the work is limited to what that app's licence and local law permit, and the owner is responsible for that determination.)
- [ ] Analysis is limited to the owner's own device/account/test data.
- [ ] No network traffic will be sent to the vendor's servers beyond normal use of the app with the owner's own account.

If any box cannot be ticked, Claude Code stops and reports.

---

## 3. Discovery questions (Claude Code asks these first, in a single message)

Because the PRD cannot assume how RestOrTrain is shipped, Claude Code must determine the target type before choosing tools. Ask the owner, in one message:

1. Platform of RestOrTrain: iOS, Android, web app, desktop, or other?
2. Where is the artifact: installed on the owner's machine/phone, an `.apk`/`.ipa`/`.app`, a URL, or already inside the `ROT` repo?
3. What does the owner care about most (the "rest vs train" decision logic, the data model, the UI flow, integrations such as wearables)?
4. Preferred stack for the rebuild (default: whatever `ROT` already uses; otherwise TypeScript + a simple web UI).
5. Which free model/provider does the owner have access to (Section 4)?

Record answers in `docs/00-scope.md`.

---

## 4. Model strategy: free first

### 4.1 Principle
Run the whole workflow on a free model first. Escalate only per step, with a recorded reason.

### 4.2 Candidate free options (owner picks; availability and limits change, so verify current terms)
| Option | How it plugs in | Notes |
|---|---|---|
| Gemini CLI free tier | Use as the coding agent in place of Claude Code | Generous free quota; REA lists Gemini CLI as compatible |
| OpenRouter `:free` models routed into Claude Code | Gateway/router via `ANTHROPIC_BASE_URL` (e.g. a Claude Code router) | Rate limits; quality varies by model |
| Local model via Ollama / LM Studio | Same gateway approach | No cost or data leaving machine; needs strong hardware and a model good at tool-calling |
| Cursor / Codex free allowances | REA setup supports them | Limits vary |

### 4.3 Requirements for any model used
- Must support **tool/function calling** reliably (REA works through MCP tools).
- Context window large enough to hold function dossiers (summarise aggressively if small).

### 4.4 Escalation rules
Escalate to a stronger model only when one of these is logged in `docs/model-log.md`:
- The free model fails the same step twice with the same error.
- It hallucinates tool outputs (claims a result without a tool call).
- A step needs long-context synthesis that exceeds the model's window.

`docs/model-log.md` records: step, model used, outcome, whether escalated, why. This gives the owner data on what free models can and cannot do.

---

## 5. Environment setup (Phase 0)

Claude Code must run these and report results. Use the Bash tool; do not skip verification.

1. **Prerequisites check:** `node --version` (REA needs Node.js 22.19 or newer), `git --version`, `python3 --version`.
2. **Clone the repo:**
   ```bash
   git clone https://github.com/bryanyyj/ROT.git
   cd ROT
   git checkout -b feat/rea-reverse-engineering
   ```
   If the clone fails (auth, network), stop and report the exact error. Do not retry with alternative hosts.
3. **Inspect the repo:** list the tree, read `README`, `package.json`/equivalent, and any existing `docs/`. Summarise what is already there. Do not overwrite existing files without asking.
4. **Install REA and the skill:**
   ```bash
   npx -y rea-agents setup      # installs REA and the REA skill; confirm config changes when prompted
   npx -y rea-agents doctor     # verify install
   ```
   Alternatively, install the skill only: `npx skills add morluto/rea`.
5. **Optional Companion skill** (model-independent, adds requirements/architecture/roadmap/validation workflows): install per the instructions in `ShadowSwaps/REA-Reconstruction-Companion`. Read its README first and follow its documented installer.
6. **Native decompiler (only if the target is a native binary):** REA needs Hopper, Ghidra or IDA installed. Ghidra is free; prefer it. Hopper requires its own licence.
7. **Create the docs scaffold** inside `ROT`:
   ```
   docs/
     00-scope.md
     01-target-inventory.md
     02-behaviour-spec.md
     03-evidence-log.md
     04-architecture.md
     05-roadmap.md
     06-validation-report.md
     model-log.md
   evidence/            # raw REA outputs, dossiers, captures
   ```
8. Commit scaffold: `chore: add RE docs scaffold`.

**CHECKPOINT 0:** report setup status and the answers to Section 3. Wait for owner go-ahead.

---

## 6. Operating rules for Claude Code

- **Work only inside `ROT`.** Never modify files outside it except installing tools.
- **Branching:** all work on `feat/rea-reverse-engineering`. Open a PR at the end; do not merge or push to `main` without explicit approval.
- **Commits:** small, one logical change each, conventional-commit style.
- **Secrets:** never write API keys, tokens or credentials into files or commits. Use `.env` (gitignored) and `.env.example`.
- **Evidence first:** no behaviour claim without an evidence ID (Section 8).
- **Ask before:** installing system-level software, running anything that modifies the owner's device settings, making network calls to third-party services, force-pushing, or deleting files.
- **Be honest about gaps:** unknowns are listed, not filled with plausible fiction.
- **Keep the owner informed:** after each phase give 3-5 sentences: what was found, what is unknown, what is next.

---

## 7. Phases

### Phase 1: Target inventory
**Objective:** know exactly what RestOrTrain is made of.
**Tasks**
- Identify the artifact type and its structure (for example package contents, bundles, frameworks, assets, manifests, permissions, declared endpoints).
- For web targets: list JS bundles, routes, API endpoints observed from the owner's own session, storage keys.
- For mobile/desktop targets: use REA analyse/decompile commands to list modules, classes, strings, entitlements/permissions.
- Identify third-party SDKs and libraries (analytics, health/wearable integrations, auth, notifications).
**Outputs:** `docs/01-target-inventory.md`, raw outputs in `evidence/`.
**Done when:** every top-level component is listed with an evidence ID and a one-line purpose or `UNKNOWN`.

### Phase 2: Behaviour investigation
**Objective:** extract the logic that makes RestOrTrain "RestOrTrain", chiefly **how it decides between resting and training**.
**Tasks**
- Locate the decision logic: inputs (for example sleep, HRV, resting heart rate, soreness, training load, schedule, user goals), calculations, thresholds, weights, and outputs (recommendation, score, explanation text).
- Extract the **data model**: entities, fields, types, relationships, persistence (local DB, files, cloud).
- Map **user flows**: onboarding, daily check-in, recommendation, history, settings.
- Map **integrations**: wearables, calendars, health platforms, notifications.
- Use REA function dossiers and process capture (where applicable) to confirm behaviour at runtime, not just statically.
- For each behaviour, write: description, inputs, outputs, formula or rule (pseudo-code), edge cases, evidence IDs, confidence (High/Med/Low).
**Outputs:** `docs/02-behaviour-spec.md`, `docs/03-evidence-log.md`.
**Done when:** the core recommendation logic is specified precisely enough that someone could implement it without seeing the original, with remaining uncertainties explicitly listed.

**CHECKPOINT 1:** present the behaviour spec summary and the top unknowns. Owner decides which behaviours are in scope for the rebuild.

### Phase 3: Architecture and roadmap
**Objective:** design the rebuild in `ROT`.
**Tasks**
- Choose the stack (default: match existing `ROT` stack; justify any change).
- Define modules, data schema, API/contracts, and a clean separation of **decision engine** (pure functions, fully testable) from UI and I/O.
- Write an ADR for each major decision.
- Create a staged roadmap: MVP (decision engine plus minimal UI), then data persistence, then integrations, then polish. Each stage has acceptance criteria.
- Define a "similarity" target: which behaviours must match exactly (decision outputs for given inputs) and which may differ (visuals, copy).
**Outputs:** `docs/04-architecture.md`, `docs/05-roadmap.md`.

**CHECKPOINT 2:** owner approves architecture and MVP scope before any build.

### Phase 4: Implementation
**Objective:** build the approved scope.
**Tasks**
- Implement the decision engine first as pure, dependency-free code with unit tests derived from the behaviour spec (each test cites an evidence ID).
- Build the UI/IO layer around it.
- Use original assets, names and copy. Do not reproduce RestOrTrain's proprietary content.
- Keep the README current: setup, run, test commands.
**Done when:** MVP runs locally with one command and all tests pass.

### Phase 5: Validation
**Objective:** prove the rebuild behaves like the original.
**Tasks**
- Build a **golden test set**: input/output pairs observed from the original (owner's own data) and compared against the rebuild.
- Report match rate, list divergences, and classify each (bug, deliberate difference, unknown original behaviour).
- Run linting, type checks, and tests; record results.
**Outputs:** `docs/06-validation-report.md`.

**CHECKPOINT 3:** review report with owner. Decide on follow-up iterations.

### Phase 6: Handover
- Final docs pass, open a PR with a summary, link to the validation report and `docs/model-log.md`.
- Include a short "what the free model handled vs where it needed escalation" summary.

---

## 8. Evidence standard

Every finding gets an ID `EV-###` in `docs/03-evidence-log.md`:

| Field | Content |
|---|---|
| ID | `EV-001` |
| Source | tool + command (for example `rea decompile ...`) or capture method |
| Artifact | file/function/endpoint examined |
| Observation | what was literally seen |
| Raw output | path under `evidence/` |
| Date | when captured |

The behaviour spec references these IDs. A behaviour with no evidence ID is `UNKNOWN`. Static-only findings are marked `Static`, runtime-confirmed ones `Runtime-confirmed`.

---

## 9. Deliverables checklist

- [ ] `docs/00-scope.md` with authorisation confirmed and discovery answers
- [ ] `docs/01-target-inventory.md`
- [ ] `docs/02-behaviour-spec.md`
- [ ] `docs/03-evidence-log.md` plus `evidence/`
- [ ] `docs/04-architecture.md` with ADRs
- [ ] `docs/05-roadmap.md`
- [ ] Working MVP in `ROT` with tests
- [ ] `docs/06-validation-report.md`
- [ ] `docs/model-log.md`
- [ ] PR on `feat/rea-reverse-engineering`

---

## 10. Success criteria

- Core rest-or-train decision logic reproduced with a documented match rate against golden tests (target: at least 90% on in-scope cases, adjustable by owner at Checkpoint 2).
- Every behaviour claim traceable to evidence or labelled `UNKNOWN`.
- Entire workflow reproducible by a fresh clone following the README.
- No proprietary assets or secrets committed.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Free model hallucinates tool results | Require tool-call evidence for every claim; log and escalate per 4.4 |
| Small context window | Work function-by-function, store dossiers on disk, summarise into the spec |
| Target is obfuscated or encrypted | Record as a limitation; fall back to runtime observation of owner's own data |
| Native decompiler licence cost | Prefer Ghidra (free) |
| Legal or ToS exposure | Section 2 gate; stop if unconfirmed |
| Scope creep | Owner-approved scope at Checkpoints 1 and 2 |
| Free-tier rate limits | Batch work, checkpoint progress to disk, resume next session |

---

## 12. First message Claude Code should send the owner

> I've read the PRD. Before I start, I need to confirm authorisation for analysing RestOrTrain (Section 2) and get answers to the five discovery questions in Section 3. Once confirmed I'll clone `bryanyyj/ROT`, create the `feat/rea-reverse-engineering` branch, install REA, and report back at Checkpoint 0.
