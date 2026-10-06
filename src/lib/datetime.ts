const DEFAULT_TIMEZONE = "UTC";

export function formatDate(
  date: Date | string | number,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const d = typeof date === "object" ? date : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(
  date: Date | string | number,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const d = typeof date === "object" ? date : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatTime(
  date: Date | string | number,
  timeZone: string = DEFAULT_TIMEZONE,
): string {
  const d = typeof date === "object" ? date : new Date(date);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatRelative(date: Date | string | number): string {
  const d = typeof date === "object" ? date : new Date(date);
  const now = Date.now();
  const diffInSeconds = Math.round((d.getTime() - now) / 1000);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  const absDiff = Math.abs(diffInSeconds);
  if (absDiff < 60) {
    return rtf.format(diffInSeconds, "second");
  }
  const diffInMinutes = Math.round(diffInSeconds / 60);
  if (Math.abs(diffInMinutes) < 60) {
    return rtf.format(diffInMinutes, "minute");
  }
  const diffInHours = Math.round(diffInMinutes / 60);
  if (Math.abs(diffInHours) < 24) {
    return rtf.format(diffInHours, "hour");
  }
  const diffInDays = Math.round(diffInHours / 24);
  return rtf.format(diffInDays, "day");
}
