# Coaching context and presentation (2026-10-28)

## Retrospective reviews

The old endpoint reused the live coaching prompt (today's readiness and recent activities) and asked
for a next step, even for months-old workouts. A sentence saying readiness applied to today was not
enough to separate retrospective analysis from immediate advice.

Completed reviews now have a separate prompt builder (`apps/server/src/review.ts`). It supplies the
workout date, review date, elapsed days, recorded metrics/profile, preceding 14 days of activities,
and load estimates reconstructed only through the day before the workout. It excludes current
wellness, current readiness verdicts, current schedule preferences and later activities. With fewer
than seven calendar days of preceding history it omits load estimates; sparse history is identified.
These estimates are based only on synced records, not a claim of complete historical coverage.

The response asks for Session summary, Execution, Training context and Takeaway, in past tense.
Takeaways concern comparable sessions, not today's or tomorrow's recovery. Planned session reviews
use a separate prospective prompt, identifying the planned date and the date of current readiness.

## A remembered training week

`GET /api/training-schedule` returns saved preferences, effective weekdays, inferred suggestions and
evidence counts. `POST /api/training-schedule` accepts a validated timezone and seven entries in
Monday–Sunday order: `null` means Auto, `[]` means a fixed rest day, and arrays of Swim/Ride/Run mean
fixed sport days. Multiple sports are supported. The existing local JSON store persists preferences
independently of activity sync; write failures roll back the in-memory change and return an error.

Auto uses up to eight completed calendar weeks from synced history. A sport must appear on that
weekday in at least two weeks and at least half the observed weeks. Same-day repeats count once.
Sport variants such as VirtualRide and TrailRun normalize to Ride and Run. One-offs and missing
records do not establish recurring sport or rest days. Inferred patterns are explicitly provisional.

Profile's **Your training week** lets the athlete select sports, Rest or Auto for each day and save
once. The server includes the schedule in every new chat/plan prompt and prospective review. Saved
preferences override inferred patterns. Current chat instructions may make temporary exceptions,
but the coach must not claim those instructions changed persisted preferences. Durable changes use
the Profile editor. Current preferences are not applied retroactively to historical workouts.

The calendar's deterministic planner also follows these weekdays, emits separate IDs/cards for
multiple sports and honors explicit rest days. Today's readiness can still override a training day.
Unknown days remain provisional. Chat-generated plans still do not write structured calendar edits.

## Dates and formatting

Requests pass the browser timezone; date-only calculations use UTC calendar arithmetic to avoid
daylight-saving shifts. Prompts receive exact weekday/date pairs and their scheduled sports for the
next 14 days, rather than asking the model to work out weekday names. Wellness is used only when its
date matches the assessment date; a months-old check-in no longer supplies today's sleep/HRV.

Chat and reviews share `CoachText`, using [react-markdown](https://github.com/remarkjs/react-markdown)
and [remark-gfm](https://github.com/remarkjs/remark-gfm). Headings, emphasis, lists, links and tables
render as structured text, including partial streamed messages. Tables scroll within narrow screens.
Single tildes remain approximation marks; double tildes support deliberate strikethrough. Raw HTML
and images are disabled, and the renderer retains its safe URL handling. No extra LLM call is used
to reformat responses; the existing free-only cost guard remains intact.

## Validation

`npm test` runs 49 tests across engine, server and web. Added coverage includes six-month-old reviews,
exclusion of later activities/current readiness, missing historical data, stale wellness, timezone
boundaries, recurrence inference, saved overrides, multi-sport plans, schedule persistence after reload
and sync, failed writes, API prompt injection and Markdown rendering/safety.

Browser checks cover the Profile editor, an isolated save/reload test, multi-sport selection, Auto,
formatted chat and a real September workout review using the configured free model. Chat and schedule
layouts were checked at 320, 390 and 560 px. Test schedules were not saved to the athlete's live data.
