// Garmin Connect adapter — structure in place, pending Garmin Developer Program approval.
//
// Garmin's Health/Activity APIs require an approved developer account and OAuth1.0a/2.0
// credentials that are NOT self-serve (unlike Strava). Until approval, use Strava or the
// file-import path. Intervals.icu (simple API key) is the practical shortcut for
// Garmin-sourced data because it already aggregates Garmin + Strava.
//
// When credentials are granted, implement: OAuth, then map Garmin daily summaries
// (HRV, sleep, resting HR, Body Battery) -> Wellness and activities -> Activity.

export const GARMIN_STATUS = {
  available: false,
  reason:
    "Garmin Connect API requires Developer Program approval (not instant). Use Strava or file import for now; Intervals.icu is a fast alternative for Garmin data.",
};
