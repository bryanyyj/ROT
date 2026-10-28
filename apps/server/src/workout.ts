import type { Activity, WorkoutProfile } from "./types.js";

export type ActivityStreams = Partial<Record<"time" | "watts" | "velocity_smooth" | "heartrate", { data: number[] }>>;
export interface ActivityZone {
  type: string;
  distribution_buckets: { min: number; max: number }[];
}

/** Time-weighted chronological bins; never fabricate intervals from an activity average. */
export function buildWorkoutProfile(activity: Activity, streams: ActivityStreams, zones: ActivityZone[] = []): WorkoutProfile | null {
  const time = streams.time?.data;
  if (!time || time.length < 2) return null;
  const metric = /run/i.test(activity.type) && streams.velocity_smooth ? "pace"
    : streams.watts ? "power" : streams.heartrate ? "heartrate"
    : streams.velocity_smooth ? "pace" : null;
  if (!metric) return null;
  const values = (metric === "pace" ? streams.velocity_smooth : metric === "power" ? streams.watts : streams.heartrate)!.data;
  const start = time[0]!;
  const end = time[time.length - 1]!;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const count = Math.min(24, time.length - 1);
  const width = (end - start) / count;
  const ranges = zones.find((z) => z.type === metric)?.distribution_buckets;
  const bars = Array.from({ length: count }, (_, b) => {
    const from = start + b * width;
    const to = start + (b + 1) * width;
    let weighted = 0, seconds = 0;
    for (let i = 0; i < time.length - 1; i++) {
      const value = values[i];
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0) continue;
      const overlap = Math.max(0, Math.min(to, time[i + 1]!) - Math.max(from, time[i]!));
      weighted += value * overlap;
      seconds += overlap;
    }
    const value = seconds > 0 ? weighted / seconds : null;
    const zone = value === null ? -1 : (ranges?.findIndex((r) => value >= r.min && (r.max < 0 || value < r.max)) ?? -1);
    return { startSec: from - start, endSec: to - start, value, ...(zone >= 0 ? { zone: zone + 1 } : {}) };
  });
  if (bars.every((bar) => bar.value === null)) return null;
  return { metric, bars, estimated: metric === "power" && activity.powerEstimated };
}
