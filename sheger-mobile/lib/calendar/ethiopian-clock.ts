import { pad2, normalizeTime24 } from "@/lib/calendar/timezone";

export type EthiopianPeriod = "ጠዋት" | "ማታ";

export type EthiopianWallClock = {
  hour: number;
  minute: number;
  period: EthiopianPeriod;
};

export const ETHIOPIAN_PERIODS: EthiopianPeriod[] = ["ጠዋት", "ማታ"];

/** GC 24-hour HH:MM (Addis civil time) → Ethiopian wall clock. */
export function gc24ToEthiopianWall(gc24: string): EthiopianWallClock | null {
  const normalized = normalizeTime24(gc24);
  if (!normalized) return null;

  const [h, m] = normalized.split(":").map(Number);
  let ethHour = (h - 6 + 24) % 12;
  if (ethHour === 0) ethHour = 12;
  const period: EthiopianPeriod = h >= 6 && h < 18 ? "ጠዋት" : "ማታ";
  return { hour: ethHour, minute: m, period };
}

/** Ethiopian wall clock → GC 24-hour HH:MM for storage. */
export function ethiopianWallToGc24(wall: EthiopianWallClock): string | null {
  const { hour, minute, period } = wall;
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

  let gcHour: number;
  if (period === "ጠዋት") {
    gcHour = hour === 12 ? 6 : hour + 6;
  } else {
    gcHour = hour === 12 ? 18 : (hour + 18) % 24;
  }

  return `${pad2(gcHour)}:${pad2(minute)}`;
}

export function formatEthiopianWallLabel(wall: EthiopianWallClock): string {
  return `${wall.hour}:${pad2(wall.minute)} ${wall.period}`;
}
