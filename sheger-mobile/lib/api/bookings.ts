import { supabase } from "@/lib/supabase";
import type { Booking, WorkingHours } from "@/lib/types/database";

export async function fetchWorkingHours(businessId: string, dayOfWeek: number) {
  const { data, error } = await supabase
    .from("working_hours")
    .select("*")
    .eq("business_id", businessId)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  if (error) throw error;
  return data as WorkingHours | null;
}

export async function fetchBookingsForDay(businessId: string, date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("bookings")
    .select("scheduled_at, duration_minutes, status")
    .eq("business_id", businessId)
    .gte("scheduled_at", start.toISOString())
    .lte("scheduled_at", end.toISOString())
    .neq("status", "cancelled");

  if (error) throw error;
  return (data ?? []) as Pick<Booking, "scheduled_at" | "duration_minutes">[];
}

export type CreateBookingInput = {
  customerId: string;
  businessId: string;
  serviceId: string;
  employeeId?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  paymentMethod: string;
  notes?: string;
};

export async function createBooking(input: CreateBookingInput) {
  const { data, error } = await supabase
    .from("bookings")
    .insert({
      customer_id: input.customerId,
      business_id: input.businessId,
      service_id: input.serviceId,
      employee_id: input.employeeId ?? null,
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
      payment_method: input.paymentMethod,
      status: "pending",
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Booking;
}

export async function fetchBookingById(id: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, businesses(name, address), services(name, price)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}
