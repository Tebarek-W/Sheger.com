import { supabase } from "@/lib/supabase";
import type {
  Booking,
  BookingStatus,
  Business,
  Employee,
  Service,
  WorkingHours,
} from "@/lib/types/database";

export type CreateBusinessInput = {
  ownerId: string;
  categoryId: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type CreateServiceInput = {
  businessId: string;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
};

export type CreateEmployeeInput = {
  businessId: string;
  fullName: string;
  role?: string;
};

export type WorkingHoursInput = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export type OwnerStats = {
  totalBookings: number;
  pendingBookings: number;
  completedBookings: number;
  totalRevenue: number;
  last30DaysRevenue: number;
};

export async function fetchMyBusinesses(ownerId: string) {
  const { data, error } = await supabase
    .from("businesses")
    .select("*, categories(name, slug)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as (Business & { categories: { name: string; slug: string } | null })[];
}

export async function createBusiness(input: CreateBusinessInput) {
  const { data, error } = await supabase
    .from("businesses")
    .insert({
      owner_id: input.ownerId,
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      city: input.city ?? "Addis Ababa",
      phone: input.phone ?? null,
      email: input.email ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Business;
}

export async function updateBusiness(
  businessId: string,
  input: Partial<CreateBusinessInput>,
) {
  const { data, error } = await supabase
    .from("businesses")
    .update({
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      city: input.city ?? "Addis Ababa",
      phone: input.phone ?? null,
      email: input.email ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
    })
    .eq("id", businessId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Business;
}

export async function fetchMyServices(businessId: string) {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Service[];
}

export async function createService(input: CreateServiceInput) {
  const { data, error } = await supabase
    .from("services")
    .insert({
      business_id: input.businessId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      duration_minutes: input.durationMinutes,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Service;
}

export async function updateService(
  serviceId: string,
  input: Partial<CreateServiceInput> & { is_active?: boolean },
) {
  const { data, error } = await supabase
    .from("services")
    .update({
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      duration_minutes: input.durationMinutes,
      is_active: input.is_active,
    })
    .eq("id", serviceId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Service;
}

export async function fetchMyEmployees(businessId: string) {
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Employee[];
}

export async function createEmployee(input: CreateEmployeeInput) {
  const { data, error } = await supabase
    .from("employees")
    .insert({
      business_id: input.businessId,
      full_name: input.fullName,
      role: input.role ?? null,
      is_active: true,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(
  employeeId: string,
  input: Partial<CreateEmployeeInput> & { is_active?: boolean },
) {
  const { data, error } = await supabase
    .from("employees")
    .update({
      full_name: input.fullName,
      role: input.role ?? null,
      is_active: input.is_active,
    })
    .eq("id", employeeId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Employee;
}

export async function fetchMyWorkingHours(businessId: string) {
  const { data, error } = await supabase
    .from("working_hours")
    .select("*")
    .eq("business_id", businessId)
    .order("day_of_week");

  if (error) throw error;
  return data as WorkingHours[];
}

export async function saveWorkingHours(businessId: string, hours: WorkingHoursInput[]) {
  const rows = hours.map((h) => ({
    business_id: businessId,
    day_of_week: h.day_of_week,
    open_time: h.open_time,
    close_time: h.close_time,
    is_closed: h.is_closed,
  }));

  const { data, error } = await supabase
    .from("working_hours")
    .upsert(rows, { onConflict: "business_id,day_of_week" })
    .select("*");

  if (error) throw error;
  return data as WorkingHours[];
}

export type OwnerBooking = Booking & {
  profiles: { full_name: string | null; phone: string | null } | null;
  services: { name: string; price: number } | null;
};

export async function fetchMyBookings(businessId: string) {
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, services(name, price)")
    .eq("business_id", businessId)
    .order("scheduled_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  if (!bookings?.length) return [] as OwnerBooking[];

  const customerIds = [...new Set(bookings.map((b) => b.customer_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .in("id", customerIds);

  if (profilesError) throw profilesError;

  const profileById = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, phone: p.phone }]),
  );

  return bookings.map((booking) => ({
    ...booking,
    profiles: profileById.get(booking.customer_id) ?? null,
  })) as OwnerBooking[];
}

export async function updateOwnerBookingStatus(bookingId: string, status: BookingStatus) {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Booking;
}

export async function fetchOwnerStats(businessId: string): Promise<OwnerStats> {
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("status, scheduled_at, services(price)")
    .eq("business_id", businessId);

  if (error) throw error;

  const rows = bookings ?? [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

  let totalRevenue = 0;
  let last30DaysRevenue = 0;
  let pendingBookings = 0;
  let completedBookings = 0;

  rows.forEach((row) => {
    if (row.status === "pending") pendingBookings += 1;
    if (row.status === "completed") {
      completedBookings += 1;
      const price = (row.services as { price: number } | null)?.price ?? 0;
      totalRevenue += Number(price);
      if (new Date(row.scheduled_at).getTime() >= thirtyDaysAgo) {
        last30DaysRevenue += Number(price);
      }
    }
  });

  return {
    totalBookings: rows.length,
    pendingBookings,
    completedBookings,
    totalRevenue,
    last30DaysRevenue,
  };
}
