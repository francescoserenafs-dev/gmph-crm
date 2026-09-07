const APP_TIME_ZONE = "Europe/Rome";

// Offset (in minutes) such that <local wall clock> = <UTC instant> + offset, at the given instant.
function getTimeZoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return (asUtc - instant.getTime()) / 60_000;
}

// Parses a wall-clock string from a <input type="datetime-local"> (e.g. "2026-09-17T18:00") as Europe/Rome
// local time, regardless of the server's own timezone (Vercel runs in UTC, which caused a 2h shift).
export function parseLocalDateTime(value: string): Date {
  const naiveUtc = new Date(`${value}:00.000Z`);
  if (Number.isNaN(naiveUtc.valueOf())) return naiveUtc;
  const offsetMinutes = getTimeZoneOffsetMinutes(naiveUtc, APP_TIME_ZONE);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60_000);
}
