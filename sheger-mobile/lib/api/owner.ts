import { buildDefaultWorkingHours } from "@/lib/business/default-working-hours";
import { supabase } from "@/lib/supabase";
import { getBookingRevenueAmount } from "@/lib/services/pricing";
import { normalizeEmail, normalizeEthiopianMobile } from "@/lib/validation/contact";
import type {
  Booking,
  BookingStatus,
  Business,
  Employee,
  Service,
  ServiceDurationModel,
  ServicePricingModel,
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
  pricingModel: ServicePricingModel;
  durationModel: ServiceDurationModel;
  price?: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  durationMinutes: number;
  schedulingBlockMinutes?: number | null;
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
  confirmedBookings: number;
  completedBookings: number;
  totalRevenue: number;
  last30DaysRevenue: number;
  byStatus?: Record<BookingStatus, number>;
};

export type CompleteBookingInput = {
  finalPrice?: number | null;
  actualDurationMinutes?: number | null;
};

function buildServiceRow(input: CreateServiceInput) {
  return {
    business_id: input.businessId,
    name: input.name,
    description: input.description ?? null,
    pricing_model: input.pricingModel,
    duration_model: input.durationModel,
    price: input.price ?? null,
    price_min: input.priceMin ?? null,
    price_max: input.priceMax ?? null,
    duration_minutes: input.durationMinutes,
    scheduling_block_minutes: input.schedulingBlockMinutes ?? input.durationMinutes,
    is_active: true,
  };
}

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
  const phone = normalizeEthiopianMobile(input.phone) || null;
  const email = normalizeEmail(input.email) || null;

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      owner_id: input.ownerId,
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      city: input.city ?? "Addis Ababa",
      phone,
      email,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) throw error;

  const business = data as Business;
  await saveWorkingHours(business.id, buildDefaultWorkingHours());
  return business;
}

export async function updateBusiness(
  businessId: string,
  input: Partial<CreateBusinessInput>,
) {
  const phone = normalizeEthiopianMobile(input.phone) || null;
  const email = normalizeEmail(input.email) || null;

  const { data, error } = await supabase
    .from("businesses")
    .update({
      category_id: input.categoryId,
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      city: input.city ?? "Addis Ababa",
      phone,
      email,
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
    .insert(buildServiceRow(input))
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
      pricing_model: input.pricingModel,
      duration_model: input.durationModel,
      price: input.price ?? null,
      price_min: input.priceMin ?? null,
      price_max: input.priceMax ?? null,
      duration_minutes: input.durationMinutes,
      scheduling_block_minutes: input.schedulingBlockMinutes ?? input.durationMinutes,
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
  services: Service | null;
};

type OwnerBookingPage = {
  rows: OwnerBooking[];
  next_cursor: { scheduled_at: string; id: string } | null;
  limit: number;
};

async function fetchMyBookingsDirect(businessId: string) {
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("*, services(*)")
    .eq("business_id", businessId)
    .order("scheduled_at", { ascending: false })
    .limit(50);

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

export async function fetchMyBookings(businessId: string) {
  const { data, error } = await supabase.rpc("list_business_booking_cards_page", {
    p_business_id: businessId,
    p_limit: 50,
    p_cursor_scheduled_at: undefined,
    p_cursor_id: undefined,
  });

  if (!error && data && typeof data === "object" && "rows" in data) {
    const page = data as OwnerBookingPage;
    if (Array.isArray(page.rows)) {
      return page.rows;
    }
  }

  if (__DEV__ && error) {
    console.warn(
      "[Sheger] list_business_booking_cards_page failed, using direct query:",
      error.message ?? error,
    );
  }

  return fetchMyBookingsDirect(businessId);
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

export async function completeOwnerBooking(bookingId: string, input: CompleteBookingInput = {}) {
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "completed",
      final_price: input.finalPrice ?? null,
      actual_duration_minutes: input.actualDurationMinutes ?? null,
    })
    .eq("id", bookingId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Booking;
}

type OwnerStatsRpcPayload = Partial<OwnerStats> & {
  byStatus?: Partial<Record<BookingStatus, number>>;
  by_status?: Partial<Record<BookingStatus, number>>;
};

function readStatNumber(
  record: Record<string, unknown>,
  camel: string,
  snake: string,
): number {
  const value = record[camel] ?? record[snake];
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeOwnerStatsPayload(raw: unknown): OwnerStats | null {
  const parsed =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as OwnerStatsRpcPayload & Record<string, unknown>;
  const byStatusRaw = record.byStatus ?? record.by_status;

  return {
    totalBookings: readStatNumber(record, "totalBookings", "total_bookings"),
    pendingBookings: readStatNumber(record, "pendingBookings", "pending_bookings"),
    confirmedBookings: readStatNumber(record, "confirmedBookings", "confirmed_bookings"),
    completedBookings: readStatNumber(record, "completedBookings", "completed_bookings"),
    totalRevenue: readStatNumber(record, "totalRevenue", "total_revenue"),
    last30DaysRevenue: readStatNumber(record, "last30DaysRevenue", "last_30_days_revenue"),
    byStatus:
      byStatusRaw && typeof byStatusRaw === "object" && !Array.isArray(byStatusRaw)
        ? {
            pending: Number(byStatusRaw.pending ?? 0),
            confirmed: Number(byStatusRaw.confirmed ?? 0),
            cancelled: Number(byStatusRaw.cancelled ?? 0),
            completed: Number(byStatusRaw.completed ?? 0),
          }
        : undefined,
  };
}

async function fetchOwnerStatsDirect(businessId: string): Promise<OwnerStats> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [bookingsRes, financialsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, status, scheduled_at, payment_status, listed_price, listed_price_min, final_price, services(price)",
      )
      .eq("business_id", businessId),
    supabase
      .from("booking_financials")
      .select("booking_id, owner_net_etb")
      .eq("business_id", businessId),
  ]);

  if (bookingsRes.error) throw bookingsRes.error;
  if (financialsRes.error) throw financialsRes.error;

  const ownerNetByBooking = new Map(
    (financialsRes.data ?? []).map((row) => [row.booking_id, Number(row.owner_net_etb)]),
  );

  const bookings = bookingsRes.data ?? [];
  const byStatus: Record<BookingStatus, number> = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
  };

  let totalRevenue = 0;
  let last30DaysRevenue = 0;

  for (const booking of bookings) {
    const status = booking.status as BookingStatus;
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    if (status !== "completed" || booking.payment_status !== "paid") continue;

    const ownerNet = ownerNetByBooking.get(booking.id) ?? 0;

    totalRevenue += ownerNet;

    if (new Date(booking.scheduled_at) >= thirtyDaysAgo) {
      last30DaysRevenue += ownerNet;
    }
  }

  return {
    totalBookings: bookings.length,
    pendingBookings: byStatus.pending,
    confirmedBookings: byStatus.confirmed,
    completedBookings: byStatus.completed,
    totalRevenue,
    last30DaysRevenue,
    byStatus,
  };
}

export async function fetchOwnerStats(businessId: string): Promise<OwnerStats> {
  const { data, error } = await supabase.rpc("get_owner_booking_stats", {
    p_business_id: businessId,
  });

  if (!error && data) {
    const stats = normalizeOwnerStatsPayload(data);
    if (stats) return stats;
  }

  if (__DEV__ && error) {
    console.warn(
      "[Sheger] get_owner_booking_stats failed, using direct query:",
      error instanceof Error ? error.message : error,
    );
  }

  return fetchOwnerStatsDirect(businessId);
}
