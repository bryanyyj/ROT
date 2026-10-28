# Calendar workouts (2026-10-28)

Weeks run Monday–Sunday in chronological order, with past weeks above the current and next weeks.
Past headings use dates only. Subheadings show completed training hours followed by completed load;
planned hours stay separate. The current week opens initially; other arrows point right until opened.
The calendar includes every synced activity, including multiple workouts on one day.

Completed workout cards show an interactive intensity graph, then duration, distance, cycling power
or running pace, and load. Strava summary averages populate these metrics. Load estimates and
estimated power are identified. Other sports show average heart rate when available.

Opening a week fetches recordings through `GET /api/workouts/:id/profile`. Strava time, speed,
power and heart-rate streams become up to 24 chronological, time-weighted bars. Bar heights use
speed for pace graphs, so faster running is taller. Each bar exposes its time range and average
pace/power/heart rate on hover, focus or tap. Recorded activity zone boundaries supply zone labels
where available; the app does not infer zones from observed maximum heart rate or invent an FTP.
The horizontal axis is elapsed time; the duration metric is moving time, so pauses can make them differ.

Recordings are cached in the local activity store. Requests in flight are shared between graphs and
reviews. Missing recordings have an explicit empty state; failed requests have a retry action.
Planned workouts show their prescribed intensity, not a fabricated recording. Planned distance,
power/pace and load remain unavailable until the planning model supplies them.

The Review button calls `POST /api/workouts/review` with either `activityId` or `plannedId`.
The server looks up that workout and calls the existing OpenRouter completion function with its
free-model cost guard. Completed reviews use the recording and historical context before the workout;
planned reviews use the current readiness and recurring schedule. Reviews display formatted Markdown with
loading and retry states; hiding/reopening an existing review does not generate another request.
Multiple planned sports on the same date remain separate cards with unique IDs. Completing one sport
does not remove another sport's planned session. See `08-coach-context.md` for persistent scheduling.

API reference: [Strava activity streams, zones and summary metrics](https://developers.strava.com/docs/reference/).

Validation: `npm test` includes engine, calendar grouping/metrics, recording aggregation and workout
API tests. Live browser checks passed with connected Strava data and an actual AI review, at widths
320, 390 and 560 px, including accordion rotation and keyboard bar selection. The Impeccable detector
reported no findings on the changed UI.
