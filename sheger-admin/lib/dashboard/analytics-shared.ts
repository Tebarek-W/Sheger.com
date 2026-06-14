export type DashboardPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type TimeSeriesPoint = {
  key: string;
  label: string;
  users: number;
  businesses: number;
  bookings: number;
  revenue: number;
};

export type TopBusinessRow = {
  name: string;
  bookings: number;
  revenue: number;
};

export type DashboardAnalytics = {
  summary: {
    users: number;
    businesses: number;
    bookings: number;
    revenue: number;
    pendingBusinesses: number;
    categories: number;
  };
  bookingsByStatus: Record<string, number>;
  timeSeries: Record<DashboardPeriod, TimeSeriesPoint[]>;
  topBusinesses: TopBusinessRow[];
};

export function periodTotals(
  analytics: DashboardAnalytics,
  period: DashboardPeriod,
) {
  return analytics.timeSeries[period].reduce(
    (acc, p) => ({
      users: acc.users + p.users,
      businesses: acc.businesses + p.businesses,
      bookings: acc.bookings + p.bookings,
      revenue: acc.revenue + p.revenue,
    }),
    { users: 0, businesses: 0, bookings: 0, revenue: 0 },
  );
}

export function formatEtb(amount: number) {
  return `${Math.round(amount).toLocaleString()} ETB`;
}
