export type EthiopianDate = {
  year: number;
  month: number;
  day: number;
};

const ETHIOPIAN_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yekatit",
  "Megabit",
  "Miazia",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
] as const;

const ETHIOPIAN_MONTHS_AM = [
  "መስከረም",
  "ጥቅምት",
  "ኅዳር",
  "ታኅሣሥ",
  "ጥር",
  "የካቲት",
  "መጋቢት",
  "ሚያዝያ",
  "ግንቦት",
  "ሰኔ",
  "ሐምሌ",
  "ነሐሴ",
  "ጳጉሜ",
] as const;

const WEEKDAYS_GC = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const WEEKDAYS_ET = ["እሑድ", "ሰኞ", "ማክሰ", "ረቡዕ", "ሐሙስ", "ዓርብ", "ቅዳሜ"] as const;

function gregorianToJdn(year: number, month: number, day: number) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function jdnToEthiopian(jdn: number): EthiopianDate {
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  const year =
    4 * Math.floor((jdn - 1723856) / 1461) +
    Math.floor(r / 365) -
    Math.floor(r / 1460);
  const month = Math.floor(n / 30) + 1;
  const day = (n % 30) + 1;
  return { year, month, day };
}

export function dateToEthiopian(date: Date): EthiopianDate {
  return jdnToEthiopian(
    gregorianToJdn(date.getFullYear(), date.getMonth() + 1, date.getDate()),
  );
}

export function ethiopianMonthName(month: number, amharic = false) {
  const idx = month - 1;
  if (idx < 0 || idx >= 13) return "";
  return amharic ? ETHIOPIAN_MONTHS_AM[idx] : ETHIOPIAN_MONTHS[idx];
}

export function formatGregorianDate(date: Date, options?: { weekday?: boolean }) {
  const weekday = options?.weekday ? `${WEEKDAYS_GC[date.getDay()]}, ` : "";
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${weekday}${month} ${date.getDate()}, ${date.getFullYear()}`;
}

export function formatEthiopianDate(et: EthiopianDate, options?: { weekday?: Date }) {
  const weekday =
    options?.weekday != null ? `${WEEKDAYS_ET[options.weekday.getDay()]}, ` : "";
  const month = ethiopianMonthName(et.month, true);
  return `${weekday}${month} ${et.day}, ${et.year}`;
}

export function formatGregorianTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** European 24-hour clock in the business timezone. */
export function formatGregorianTime24(
  date: Date,
  timeZone = "Africa/Addis_Ababa",
) {
  if (Number.isNaN(date.getTime())) return "--:--";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Ethiopian clock: day starts at 6:00 AM Addis Ababa local time. */
export function formatEthiopianTime(
  date: Date,
  timeZone = "Africa/Addis_Ababa",
) {
  if (Number.isNaN(date.getTime())) return "--:--";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  let ethHour = (hour - 6 + 24) % 12;
  if (ethHour === 0) ethHour = 12;
  const period = hour >= 6 && hour < 18 ? "ጠዋት" : "ማታ";
  return `${ethHour}:${String(minute).padStart(2, "0")} ${period}`;
}

export function formatDualDate(date: Date, options?: { weekday?: boolean }) {
  const et = dateToEthiopian(date);
  const gc = formatGregorianDate(date, options);
  const etStr = formatEthiopianDate(et, options?.weekday ? { weekday: date } : undefined);
  return { gc, et: etStr, ethiopian: et };
}

export function formatDualDateTime(iso: string, options?: { weekday?: boolean }) {
  const date = new Date(iso);
  const dualDate = formatDualDate(date, options);
  return {
    ...dualDate,
    gcTime: formatGregorianTime24(date),
    etTime: formatEthiopianTime(date),
  };
}

export function formatMonthDual(date: Date) {
  const et = dateToEthiopian(date);
  const gcMonth = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const etMonth = `${ethiopianMonthName(et.month, true)} ${et.year}`;
  return { gc: gcMonth, et: etMonth };
}
