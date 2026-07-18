import {
  formatEthiopianTime,
  formatGregorianTime24,
} from "@/lib/calendar/ethiopian";
import {
  normalizeTime24,
  referenceMonday,
  wallClockToIso,
} from "@/lib/calendar/timezone";

export type DualTimeLabels = {
  gc24: string;
  et: string;
};

/** Dual time labels for a wall-clock HH:MM (24h GC + Ethiopian). */
export function formatWallClockDual(
  hhmm: string,
  referenceDate = referenceMonday(),
): DualTimeLabels | null {
  if (!normalizeTime24(hhmm)) return null;

  const iso = wallClockToIso(referenceDate, hhmm);
  if (!iso) return null;

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return {
    gc24: formatGregorianTime24(date),
    et: formatEthiopianTime(date),
  };
}

/** Dual time labels for a booking slot ISO instant. */
export function formatSlotTimeDual(iso: string): DualTimeLabels | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  return {
    gc24: formatGregorianTime24(date),
    et: formatEthiopianTime(date),
  };
}
