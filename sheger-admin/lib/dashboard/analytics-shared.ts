export type DashboardPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type TimeSeriesPoint = {
  key: string;
  label: string;
  users: number;
  businesses: number;
  bookings: number;
  /** Completed booking gross by appointment date (scheduled_at). */
  completedGrossRevenue: number;
  /** Settled payment gross by settlement date (booking_financials.created_at). */
  paidGrossRevenue: number;
  /** Platform commission by settlement date. */
  platformCommission: number;
  /** @deprecated Use completedGrossRevenue */
  revenue: number;
};

export type TopBusinessRow = {
  name: string;
  bookings: number;
  completedGrossRevenue: number;
  paidRevenue: number;
  /** @deprecated Use completedGrossRevenue */
  revenue?: number;
};

export type DashboardAnalytics = {
  summary: {
    users: number;
    businesses: number;
    bookings: number;
    completedGrossRevenue: number;
    paidGrossRevenue: number;
    platformCommission: number;
    ownerNetRevenue: number;
    paidBookings: number;
    pendingBusinesses: number;
    categories: number;
    /** @deprecated Use completedGrossRevenue */
    revenue?: number;
  };
  bookingsByStatus: Record<string, number>;
  timeSeries: Record<DashboardPeriod, TimeSeriesPoint[]>;
  topBusinesses: TopBusinessRow[];
};

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeDashboardAnalytics(raw: unknown): DashboardAnalytics | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const summaryRaw = data.summary;
  if (!summaryRaw || typeof summaryRaw !== "object") return null;
  const summary = summaryRaw as Record<string, unknown>;

  const completedGrossRevenue = readNumber(
    summary.completedGrossRevenue ?? summary.revenue,
  );
  const paidGrossRevenue = readNumber(summary.paidGrossRevenue);
  const platformCommission = readNumber(summary.platformCommission);
  const ownerNetRevenue = readNumber(summary.ownerNetRevenue);

  const normalizePoint = (point: unknown): TimeSeriesPoint => {
    const row = (point ?? {}) as Record<string, unknown>;
    const completed = readNumber(row.completedGrossRevenue ?? row.revenue);
    return {
      key: String(row.key ?? ""),
      label: String(row.label ?? ""),
      users: readNumber(row.users),
      businesses: readNumber(row.businesses),
      bookings: readNumber(row.bookings),
      completedGrossRevenue: completed,
      paidGrossRevenue: readNumber(row.paidGrossRevenue),
      platformCommission: readNumber(row.platformCommission),
      revenue: completed,
    };
  };

  const timeSeriesRaw = (data.timeSeries ?? {}) as Record<string, unknown>;
  const periods: DashboardPeriod[] = ["daily", "weekly", "monthly", "yearly"];
  const timeSeries = Object.fromEntries(
    periods.map((period) => [
      period,
      Array.isArray(timeSeriesRaw[period])
        ? (timeSeriesRaw[period] as unknown[]).map(normalizePoint)
        : [],
    ]),
  ) as Record<DashboardPeriod, TimeSeriesPoint[]>;

  const topBusinesses = Array.isArray(data.topBusinesses)
    ? (data.topBusinesses as Record<string, unknown>[]).map((row) => {
        const completed = readNumber(row.completedGrossRevenue ?? row.revenue);
        return {
          name: String(row.name ?? ""),
          bookings: readNumber(row.bookings),
          completedGrossRevenue: completed,
          paidRevenue: readNumber(row.paidRevenue),
          revenue: completed,
        };
      })
    : [];

  return {
    summary: {
      users: readNumber(summary.users),
      businesses: readNumber(summary.businesses),
      bookings: readNumber(summary.bookings),
      completedGrossRevenue,
      paidGrossRevenue,
      platformCommission,
      ownerNetRevenue,
      paidBookings: readNumber(summary.paidBookings),
      pendingBusinesses: readNumber(summary.pendingBusinesses),
      categories: readNumber(summary.categories),
      revenue: completedGrossRevenue,
    },
    bookingsByStatus:
      data.bookingsByStatus && typeof data.bookingsByStatus === "object"
        ? (data.bookingsByStatus as Record<string, number>)
        : {},
    timeSeries,
    topBusinesses,
  };
}

export function periodTotals(analytics: DashboardAnalytics, period: DashboardPeriod) {
  return analytics.timeSeries[period].reduce(
    (acc, point) => ({
      users: acc.users + point.users,
      businesses: acc.businesses + point.businesses,
      bookings: acc.bookings + point.bookings,
      completedGrossRevenue: acc.completedGrossRevenue + point.completedGrossRevenue,
      paidGrossRevenue: acc.paidGrossRevenue + point.paidGrossRevenue,
      platformCommission: acc.platformCommission + point.platformCommission,
      revenue: acc.revenue + point.completedGrossRevenue,
    }),
    {
      users: 0,
      businesses: 0,
      bookings: 0,
      completedGrossRevenue: 0,
      paidGrossRevenue: 0,
      platformCommission: 0,
      revenue: 0,
    },
  );
}

export function formatEtb(amount: number) {
  return `${Math.round(amount).toLocaleString()} ETB`;
}
