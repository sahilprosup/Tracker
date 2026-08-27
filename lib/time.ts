// All ProLine sites are in Victoria, Australia. Checkpoints (08:30/11:30/14:30)
// and "today" boundaries are authored in Melbourne local time, but a
// deployed server (Vercel included) runs in UTC - comparing raw server time
// against those values would misattribute almost every submission. These
// helpers convert "now" into Melbourne wall-clock time/date without pulling
// in a date library.

const MELBOURNE_TZ = "Australia/Melbourne";

export function nowInMelbourne(at: Date = new Date()): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MELBOURNE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function melbourneOffsetMinutes(at: Date): number {
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: MELBOURNE_TZ,
    timeZoneName: "shortOffset",
  })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;

  const match = tzName?.match(/GMT([+-]\d+)(?::(\d+))?/);
  if (!match) return 600; // AEST fallback
  const hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + (hours < 0 ? -minutes : minutes);
}

// Returns the [start, end) of a Melbourne calendar day as UTC ISO strings,
// for querying timestamptz columns with .gte()/.lt().
export function melbourneDayBoundsUtc(dateStr: string): { start: string; end: string } {
  const offsetMinutes = melbourneOffsetMinutes(new Date(`${dateStr}T00:00:00Z`));
  const start = new Date(`${dateStr}T00:00:00Z`);
  start.setUTCMinutes(start.getUTCMinutes() - offsetMinutes);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}
