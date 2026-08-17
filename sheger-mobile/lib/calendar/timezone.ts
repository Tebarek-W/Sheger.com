/** Business operations use Ethiopia time (UTC+3, no DST). */

export function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Calendar day parts from the date picker (interpreted as an Addis Ababa calendar day). */
export function calendarDayParts(date: Date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/**
 * "Today" as the Addis Ababa calendar day, returned as a local-midnight Date so
 * it can be compared against the picker's `new Date(year, month, day)` cells.
 * Ethiopia is a fixed UTC+3 (no DST), so we shift the instant by +3h and read
 * its UTC parts — avoids relying on Intl timezone support under Hermes.
 */
export function addisToday(): Date {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return new Date(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
}

/** Minutes since midnight in Addis Ababa (UTC+3). */
export function addisMinutesNow(): number {
  const shifted = new Date(Date.now() + 3 * 60 * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Day-of-week (0=Sun) for a calendar day in Addis Ababa. */
export function dayOfWeekInAddis(date: Date): number {
  const { year, month, day } = calendarDayParts(date);
  const noon = `${year}-${pad2(month)}-${pad2(day)}T12:00:00+03:00`;
  return new Date(noon).getUTCDay();
}

/** Wall-clock HH:MM on a calendar day -> ISO instant in Addis (+03:00). */
export function wallClockToIso(calendarDate: Date, hhmm: string): string | null {
  const normalized = normalizeTime24(hhmm);
  if (!normalized) return null;
  const { year, month, day } = calendarDayParts(calendarDate);
  return `${year}-${pad2(month)}-${pad2(day)}T${normalized}:00+03:00`;
}

/** Extract HH:MM from a Postgres TIME string or user input. */
export function formatTimeFromDb(time: string | null | undefined): string {
  if (!time) return "09:00";
  const normalized = normalizeTime24(time.trim().slice(0, 5));
  if (normalized) return normalized;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (match) return `${pad2(Number(match[1]))}:${match[2]}`;
  return "09:00";
}

/** Inclusive start / exclusive end of a calendar day in Addis Ababa. */
export function addisDayBounds(date: Date) {
  const { year, month, day } = calendarDayParts(date);
  const ymd = `${year}-${pad2(month)}-${pad2(day)}`;
  return {
    start: `${ymd}T00:00:00+03:00`,
    endExclusive: `${ymd}T23:59:59.999+03:00`,
  };
}

/** Parse HH:MM (24-hour). Returns null if invalid. */
export function parseTime24(hhmm: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Whether the business is open at this instant in Addis. `null` if hours are unusable. */
export function isOpenNow(hours: {
  is_closed: boolean;
  open_time: string;
  close_time: string;
} | null): boolean | null {
  if (!hours) return null;
  if (hours.is_closed) return false;
  const open = parseTime24(formatTimeFromDb(hours.open_time));
  const close = parseTime24(formatTimeFromDb(hours.close_time));
  if (!open || !close) return null;
  const now = addisMinutesNow();
  const openM = open.hours * 60 + open.minutes;
  const closeM = close.hours * 60 + close.minutes;
  if (closeM <= openM) return now >= openM || now < closeM;
  return now >= openM && now < closeM;
}

export function normalizeTime24(hhmm: string): string | null {
  const parsed = parseTime24(hhmm);
  if (!parsed) return null;
  return `${pad2(parsed.hours)}:${pad2(parsed.minutes)}`;
}

/** Reference Monday for displaying arbitrary wall-clock times in dual format. */
export function referenceMonday(): Date {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
