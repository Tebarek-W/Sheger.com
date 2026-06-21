import "server-only";

import { getBookingRevenueAmount } from "@/lib/services/pricing";
import { getSessionProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

import type {
  DashboardAnalytics,
  DashboardPeriod,
  TimeSeriesPoint,
  TopBusinessRow,
} from "./analytics-shared";

export type {
  DashboardAnalytics,
  DashboardPeriod,
  TimeSeriesPoint,
  TopBusinessRow,
} from "./analytics-shared";
export { formatEtb, periodTotals } from "./analytics-shared";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfHour(d: Date) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

function bucketKey(date: Date, period: DashboardPeriod): string {
  if (period === "daily") {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}-${pad2(date.getHours())}`;
  }
  if (period === "weekly" || period === "monthly") {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function formatLabel(key: string, period: DashboardPeriod): string {
  if (period === "daily") {
    const [y, m, d, h] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d, h);
    return date.toLocaleTimeString("en-US", { hour: "numeric" });
  }
  if (period === "yearly") {
    const [y, mo] = key.split("-").map(Number);
    const date = new Date(y, mo - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildBuckets(period: DashboardPeriod): { key: string; label: string }[] {
  const now = new Date();
  const buckets: { key: string; label: string }[] = [];

  if (period === "daily") {
    for (let i = 23; i >= 0; i--) {
      const d = startOfHour(now);
      d.setHours(d.getHours() - i);
      const key = bucketKey(d, period);
      buckets.push({ key, label: formatLabel(key, period) });
    }
    return buckets;
  }

  if (period === "weekly") {
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(now);
      d.setDate(d.getDate() - i);
      const key = bucketKey(d, period);
      buckets.push({ key, label: formatLabel(key, period) });
    }
    return buckets;
  }

  if (period === "monthly") {
    for (let i = 29; i >= 0; i--) {
      const d = startOfDay(now);
      d.setDate(d.getDate() - i);
      const key = bucketKey(d, period);
      buckets.push({ key, label: formatLabel(key, period) });
    }
    return buckets;
  }

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = bucketKey(d, period);
    buckets.push({ key, label: formatLabel(key, period) });
  }
  return buckets;
}

function buildTimeSeries(
  period: DashboardPeriod,
  users: string[],
  businesses: string[],
  bookings: { created_at: string; revenue: number }[],
): TimeSeriesPoint[] {
  const buckets = buildBuckets(period);
  const map = new Map<string, TimeSeriesPoint>(
    buckets.map((b) => [
      b.key,
      { key: b.key, label: b.label, users: 0, businesses: 0, bookings: 0, revenue: 0 },
    ]),
  );

  for (const createdAt of users) {
    const key = bucketKey(new Date(createdAt), period);
    const row = map.get(key);
    if (row) row.users += 1;
  }

  for (const createdAt of businesses) {
    const key = bucketKey(new Date(createdAt), period);
    const row = map.get(key);
    if (row) row.businesses += 1;
  }

  for (const booking of bookings) {
    const key = bucketKey(new Date(booking.created_at), period);
    const row = map.get(key);
    if (row) {
      row.bookings += 1;
      row.revenue += booking.revenue;
    }
  }

  return buckets.map((b) => map.get(b.key)!);
}

export async function fetchDashboardAnalytics(): Promise<DashboardAnalytics | null> {
  const { isAdmin } = await getSessionProfile();
  if (!isAdmin) return null;

  const supabase = createAdminClient();

  const [
    profilesRes,
    businessesRes,
    pendingRes,
    categoriesRes,
    bookingsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("created_at"),
    supabase.from("businesses").select("created_at"),
    supabase
      .from("businesses")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("categories").select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select(
        "created_at, status, business_id, final_price, listed_price, listed_price_min, services(price), businesses(name)",
      ),
  ]);

  const userDates = (profilesRes.data ?? []).map((r) => r.created_at);
  const businessDates = (businessesRes.data ?? []).map((r) => r.created_at);

  const bookingRows = bookingsRes.data ?? [];
  const bookingsByStatus: Record<string, number> = {};
  const businessMap = new Map<string, TopBusinessRow>();
  let totalRevenue = 0;

  const bookingsForSeries = bookingRows.map((row) => {
    bookingsByStatus[row.status] = (bookingsByStatus[row.status] ?? 0) + 1;
    const price = getBookingRevenueAmount(row);
    const revenue = row.status === "completed" ? price : 0;
    totalRevenue += revenue;

    const name = (row.businesses as { name: string } | null)?.name ?? "Unknown";
    const existing = businessMap.get(row.business_id) ?? {
      name,
      bookings: 0,
      revenue: 0,
    };
    existing.bookings += 1;
    existing.revenue += revenue;
    businessMap.set(row.business_id, existing);

    return { created_at: row.created_at, revenue };
  });

  const topBusinesses = [...businessMap.values()]
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 5);

  const periods: DashboardPeriod[] = ["daily", "weekly", "monthly", "yearly"];
  const timeSeries = {} as Record<DashboardPeriod, TimeSeriesPoint[]>;
  for (const period of periods) {
    timeSeries[period] = buildTimeSeries(
      period,
      userDates,
      businessDates,
      bookingsForSeries,
    );
  }

  return {
    summary: {
      users: userDates.length,
      businesses: businessDates.length,
      bookings: bookingRows.length,
      revenue: totalRevenue,
      pendingBusinesses: pendingRes.count ?? 0,
      categories: categoriesRes.count ?? 0,
    },
    bookingsByStatus,
    timeSeries,
    topBusinesses,
  };
}
