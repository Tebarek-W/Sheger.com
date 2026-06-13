import { supabase } from "@/lib/supabase";
import type { AppointmentSlot } from "@/lib/types/database";
import {
  addisDayBounds,
  dayOfWeekInAddis,
  formatTimeFromDb,
  wallClockToIso,
} from "@/lib/calendar/timezone";

export type AppointmentSlotInput = {
  day_of_week: number;
  start_time: string;
  max_capacity: number;
  is_active?: boolean;
};

export type AvailableSlot = {
  id: string;
  scheduledAt: string;
  startTime: string;
  maxCapacity: number;
  bookedCount: number;
  remainingCapacity: number;
  isFull: boolean;
};

/** Canonical instant key — avoids ISO string format mismatches from Postgres. */
export function slotInstantKey(iso: string): number {
  return new Date(iso).getTime();
}

export async function fetchAppointmentSlots(businessId: string, dayOfWeek?: number) {
  let query = supabase
    .from("appointment_slots")
    .select("*")
    .eq("business_id", businessId)
    .order("day_of_week")
    .order("start_time");

  if (dayOfWeek !== undefined) {
    query = query.eq("day_of_week", dayOfWeek);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AppointmentSlot[];
}

export async function createAppointmentSlot(
  businessId: string,
  input: AppointmentSlotInput,
) {
  const { data, error } = await supabase
    .from("appointment_slots")
    .insert({
      business_id: businessId,
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      max_capacity: input.max_capacity,
      is_active: input.is_active ?? true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as AppointmentSlot;
}

export async function updateAppointmentSlot(
  slotId: string,
  input: Partial<AppointmentSlotInput>,
) {
  const { data, error } = await supabase
    .from("appointment_slots")
    .update({
      day_of_week: input.day_of_week,
      start_time: input.start_time,
      max_capacity: input.max_capacity,
      is_active: input.is_active,
    })
    .eq("id", slotId)
    .select("*")
    .single();

  if (error) throw error;
  return data as AppointmentSlot;
}

export async function deleteAppointmentSlot(slotId: string) {
  const { error } = await supabase.from("appointment_slots").delete().eq("id", slotId);
  if (error) throw error;
}

export async function fetchBookingCountsForDay(businessId: string, date: Date) {
  const { start, endExclusive } = addisDayBounds(date);

  const { data, error } = await supabase.rpc("get_slot_booking_counts", {
    p_business_id: businessId,
    p_range_start: start,
    p_range_end: endExclusive,
  });

  if (error) throw error;

  const counts = new Map<number, number>();
  (data ?? []).forEach((row: { scheduled_at: string; booking_count: number }) => {
    counts.set(slotInstantKey(row.scheduled_at), Number(row.booking_count));
  });
  return counts;
}

export async function fetchAvailableSlotsForDate(
  businessId: string,
  date: Date,
): Promise<AvailableSlot[]> {
  const dow = dayOfWeekInAddis(date);
  const now = Date.now();

  const [slots, counts] = await Promise.all([
    fetchAppointmentSlots(businessId, dow),
    fetchBookingCountsForDay(businessId, date),
  ]);

  const available: AvailableSlot[] = [];

  for (const slot of slots) {
    if (!slot.is_active) continue;

    const startTime = formatTimeFromDb(slot.start_time);
    const scheduledAt = wallClockToIso(date, startTime);
    if (!scheduledAt || new Date(scheduledAt).getTime() <= now) continue;

    const bookedCount = counts.get(slotInstantKey(scheduledAt)) ?? 0;
    const remaining = slot.max_capacity - bookedCount;
    const isFull = remaining <= 0;

    available.push({
      id: slot.id,
      scheduledAt,
      startTime: startTime,
      maxCapacity: slot.max_capacity,
      bookedCount,
      remainingCapacity: Math.max(remaining, 0),
      isFull,
    });
  }

  return available.sort((a, b) => a.startTime.localeCompare(b.startTime));
}
