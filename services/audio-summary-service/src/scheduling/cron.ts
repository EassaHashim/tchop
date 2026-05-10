import type { AudioIntegration } from "../types.ts";

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

/** Get current time components in a specific timezone */
function nowInTz(tz: string): { hour: number; minute: number; dayOfWeek: number; dateStr: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";

  const hour = parseInt(get("hour"));
  const minute = parseInt(get("minute"));
  const weekday = get("weekday").toLowerCase().slice(0, 3);
  const dayOfWeek = DAY_NAMES.indexOf(weekday as typeof DAY_NAMES[number]);
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;

  return { hour, minute, dayOfWeek, dateStr };
}

/** Check if a last_run_at timestamp falls on the same calendar date in the given timezone */
function lastRunDateInTz(lastRunAt: string, tz: string): string {
  const d = new Date(lastRunAt);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** ISO week number for weekly scheduling */
function isoWeek(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Determine if an integration is due for execution.
 *
 * Schedule formats:
 * - daily_HHmm     (e.g. "daily_0800")
 * - weekly_DOW_HHmm (e.g. "weekly_mon_0800")
 * - interval_Xh    (e.g. "interval_12h")
 */
export function isDue(integration: AudioIntegration): boolean {
  const { schedule, timezone, last_run_at } = integration;

  // daily_HHmm
  const dailyMatch = schedule.match(/^daily_(\d{2})(\d{2})$/);
  if (dailyMatch) {
    const targetHour = parseInt(dailyMatch[1]!);
    const targetMinute = parseInt(dailyMatch[2]!);
    const { hour, minute, dateStr } = nowInTz(timezone);

    // Not yet time today
    if (hour < targetHour || (hour === targetHour && minute < targetMinute)) return false;

    // Never run or last run was a different day
    if (!last_run_at) return true;
    return lastRunDateInTz(last_run_at, timezone) !== dateStr;
  }

  // weekly_DOW_HHmm
  const weeklyMatch = schedule.match(/^weekly_([a-z]{3})_(\d{2})(\d{2})$/);
  if (weeklyMatch) {
    const targetDay = DAY_NAMES.indexOf(weeklyMatch[1] as typeof DAY_NAMES[number]);
    const targetHour = parseInt(weeklyMatch[2]!);
    const targetMinute = parseInt(weeklyMatch[3]!);
    const { hour, minute, dayOfWeek, dateStr } = nowInTz(timezone);

    // Wrong day
    if (dayOfWeek !== targetDay) return false;
    // Not yet time
    if (hour < targetHour || (hour === targetHour && minute < targetMinute)) return false;

    // Never run or last run was a different week
    if (!last_run_at) return true;
    const lastRunDate = lastRunDateInTz(last_run_at, timezone);
    return isoWeek(lastRunDate) !== isoWeek(dateStr);
  }

  // interval_Xh
  const intervalMatch = schedule.match(/^interval_(\d+)h$/);
  if (intervalMatch) {
    const hours = parseInt(intervalMatch[1]!);
    if (!last_run_at) return true;
    const elapsed = Date.now() - new Date(last_run_at).getTime();
    return elapsed >= hours * 3600_000;
  }

  console.error(`[cron] Unknown schedule format: "${schedule}" for integration ${integration.id}`);
  return false;
}
