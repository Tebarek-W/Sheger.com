"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  formatEtb,
  periodTotals,
  type DashboardAnalytics,
  type DashboardPeriod,
} from "@/lib/dashboard/analytics-shared";

const PERIODS: { id: DashboardPeriod; label: string }[] = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

const CHART_COLORS = {
  users: "#16a34a",
  businesses: "#0d9488",
  bookings: "#2563eb",
  completedGross: "#ca8a04",
  paidGross: "#7c3aed",
  commission: "#0f766e",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#ca8a04",
  confirmed: "#16a34a",
  completed: "#2563eb",
  cancelled: "#9ca3af",
};

type DashboardChartsProps = {
  data: DashboardAnalytics;
};

export function DashboardCharts({ data }: DashboardChartsProps) {
  const [period, setPeriod] = useState<DashboardPeriod>("daily");
  const series = data.timeSeries[period];
  const totals = useMemo(() => periodTotals(data, period), [data, period]);

  const statusData = Object.entries(data.bookingsByStatus).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    key: name,
  }));

  const periodLabel =
    period === "daily"
      ? "Last 24 hours"
      : period === "weekly"
        ? "Last 7 days"
        : period === "monthly"
          ? "Last 30 days"
          : "Last 12 months";

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[var(--primary-dark)]">
            Platform performance
          </h2>
          <p className="text-sm text-[var(--muted)]">{periodLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-full border border-[var(--border)] bg-white p-1">
          {PERIODS.map((item) => {
            const active = period === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-[var(--primary)] text-white"
                    : "text-[var(--primary-dark)] hover:bg-[var(--primary-light)]"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="New users" value={String(totals.users)} hint="Account signups" />
        <StatCard label="New businesses" value={String(totals.businesses)} hint="Registrations" />
        <StatCard
          label="Bookings"
          value={String(totals.bookings)}
          hint="By appointment date"
        />
        <StatCard
          label="Completed gross"
          value={formatEtb(totals.completedGrossRevenue)}
          hint="Completed bookings · appointment date"
        />
        <StatCard
          label="Paid gross"
          value={formatEtb(totals.paidGrossRevenue)}
          hint="Settled payments · settlement date"
        />
        <StatCard
          label="Commission"
          value={formatEtb(totals.platformCommission)}
          hint="Platform share · settlement date"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          title="Growth overview"
          subtitle="Users, businesses, and bookings over time"
          className="xl:col-span-2"
        >
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="usersFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.users} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CHART_COLORS.users} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="businessesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.businesses} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CHART_COLORS.businesses} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.bookings} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CHART_COLORS.bookings} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                interval="preserveStartEnd"
              />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip content={<GrowthTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="users"
                name="Users"
                stroke={CHART_COLORS.users}
                fill="url(#usersFill)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="businesses"
                name="Businesses"
                stroke={CHART_COLORS.businesses}
                fill="url(#businessesFill)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="bookings"
                name="Bookings"
                stroke={CHART_COLORS.bookings}
                fill="url(#bookingsFill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Bookings by status" subtitle="All-time distribution">
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={98}
                  paddingAngle={3}
                >
                  {statusData.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={STATUS_COLORS[entry.key] ?? "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Completed gross trend"
          subtitle={`Completed bookings · appointment date · ${periodLabel}`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip
                formatter={(value) => formatEtb(Number(value ?? 0))}
                labelStyle={{ color: "#14532d" }}
              />
              <Bar
                dataKey="completedGrossRevenue"
                name="Completed gross"
                fill={CHART_COLORS.completedGross}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Settled payments"
          subtitle={`Paid gross and commission · settlement date · ${periodLabel}`}
        >
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
              <Tooltip
                formatter={(value) => formatEtb(Number(value ?? 0))}
                labelStyle={{ color: "#14532d" }}
              />
              <Legend />
              <Bar
                dataKey="paidGrossRevenue"
                name="Paid gross"
                fill={CHART_COLORS.paidGross}
                radius={[8, 8, 0, 0]}
              />
              <Bar
                dataKey="platformCommission"
                name="Commission"
                fill={CHART_COLORS.commission}
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard title="Top businesses" subtitle="By booking count (all time)">
        {data.topBusinesses.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={data.topBusinesses}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
              <YAxis
                type="category"
                dataKey="name"
                width={110}
                tick={{ fontSize: 11, fill: "#6b7280" }}
              />
              <Tooltip />
              <Bar dataKey="bookings" name="Bookings" fill={CHART_COLORS.users} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart />
        )}
      </ChartCard>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Total users" value={String(data.summary.users)} />
        <SummaryTile label="Total businesses" value={String(data.summary.businesses)} />
        <SummaryTile label="Total bookings" value={String(data.summary.bookings)} />
        <SummaryTile label="Paid bookings" value={String(data.summary.paidBookings)} />
        <SummaryTile
          label="Completed gross"
          value={formatEtb(data.summary.completedGrossRevenue)}
        />
        <SummaryTile label="Paid gross" value={formatEtb(data.summary.paidGrossRevenue)} />
        <SummaryTile
          label="Platform commission"
          value={formatEtb(data.summary.platformCommission)}
        />
        <SummaryTile label="Pending approval" value={String(data.summary.pendingBusinesses)} />
      </div>
    </div>
  );
}

function GrowthTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs font-semibold text-[var(--primary-dark)]">{label}</p>
      {payload.map((item) => (
        <p key={item.name} className="text-xs text-[var(--muted)]">
          <span style={{ color: item.color }}>{item.name}: </span>
          <span className="font-semibold text-[var(--primary-dark)]">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-[var(--primary-dark)]">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-sm font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-2xl font-extrabold text-[var(--primary-dark)]">{value}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm ${className}`}
    >
      <h3 className="font-bold text-[var(--primary-dark)]">{title}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[300px] items-center justify-center text-sm text-[var(--muted)]">
      No data yet.
    </div>
  );
}
