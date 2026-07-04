import { supabase } from "@/lib/supabase";
import type { Booking, BookingPaymentStatus, WorkingHours } from "@/lib/types/database";

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

export type CreateBookingInput = {
  customerId: string;
  businessId: string;
  serviceId: string;
  employeeId?: string | null;
  scheduledAt: string;
  durationMinutes: number;
  paymentMethod: string;
  paymentStatus?: BookingPaymentStatus;
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
      payment_status: input.paymentStatus ?? "not_required",
      status: "pending",
      notes: input.notes ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Booking;
}

export type CustomerBooking = Booking & {
  businesses: {
    name: string;
    address: string | null;
    city: string | null;
    cancellation_hours: number;
  } | null;
  services: { name: string; price: number } | null;
};

type BookingCardsPage = {
  rows: CustomerBooking[];
  next_cursor: { scheduled_at: string; id: string } | null;
  limit: number;
};

async function fetchCustomerBookingsDirect(customerId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select("*, businesses(name, address, city, cancellation_hours), services(name, price)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as CustomerBooking[];
}

function sortNewestFirst(bookings: CustomerBooking[]): CustomerBooking[] {
  return bookings.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function fetchCustomerBookings(customerId: string) {
  const { data, error } = await supabase.rpc("list_customer_booking_cards_page", {
    p_limit: 50,
    p_cursor_scheduled_at: undefined,
    p_cursor_id: undefined,
  });

  if (!error && data && typeof data === "object" && "rows" in data) {
    const page = data as BookingCardsPage;
    if (Array.isArray(page.rows)) {
      return sortNewestFirst(page.rows);
    }
  }

  if (__DEV__ && error) {
    console.warn(
      "[Sheger] list_customer_booking_cards_page failed, using direct query:",
      error.message ?? error,
    );
  }

  return fetchCustomerBookingsDirect(customerId);
}

export async function cancelCustomerBooking(bookingId: string) {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Booking;
}
