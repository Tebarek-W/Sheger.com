import type { Booking, WorkingHours } from "@/lib/types/database";

const SLOT_INTERVAL_MINUTES = 30;

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateTimeSlots(
  workingHours: WorkingHours | undefined,
  serviceDurationMinutes: number,
  existingBookings: Pick<Booking, "scheduled_at" | "duration_minutes">[],
  date: Date,
): string[] {
  if (!workingHours || workingHours.is_closed) return [];

  const dayStart = parseTimeToMinutes(workingHours.open_time.slice(0, 5));
  const dayEnd = parseTimeToMinutes(workingHours.close_time.slice(0, 5));

  const bookedRanges = existingBookings.map((b) => {
    const start = new Date(b.scheduled_at);
    const startMinutes = start.getHours() * 60 + start.getMinutes();
    return { start: startMinutes, end: startMinutes + b.duration_minutes };
  });

  const slots: string[] = [];
  for (
    let slotStart = dayStart;
    slotStart + serviceDurationMinutes <= dayEnd;
    slotStart += SLOT_INTERVAL_MINUTES
  ) {
    const slotEnd = slotStart + serviceDurationMinutes;
    const overlaps = bookedRanges.some(
      (range) => slotStart < range.end && slotEnd > range.start,
    );
    if (!overlaps) {
      const slotDate = new Date(date);
      slotDate.setHours(Math.floor(slotStart / 60), slotStart % 60, 0, 0);
      if (slotDate > new Date()) {
        slots.push(slotDate.toISOString());
      }
    }
  }

  return slots;
}

export function formatSlotLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-ET", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatSlotDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-ET", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export { minutesToTime };
