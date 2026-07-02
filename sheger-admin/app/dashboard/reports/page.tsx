import { createClient } from "@/lib/supabase/server";

type ReportSnapshot = {
  statusCounts: Record<string, number>;
  total: number;
  last30Days: number;
  paidBookings: number;
  paidGrossRevenue: number;
  platformCommission: number;
  last30DaysCommission: number;
  top: { name: string; count: number }[];
};

function readNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeReportSnapshot(raw: unknown): ReportSnapshot {
  const row = (raw ?? {}) as Record<string, unknown>;
  return {
    statusCounts:
      row.statusCounts && typeof row.statusCounts === "object"
        ? (row.statusCounts as Record<string, number>)
        : {},
    total: readNumber(row.total),
    last30Days: readNumber(row.last30Days),
    paidBookings: readNumber(row.paidBookings),
    paidGrossRevenue: readNumber(row.paidGrossRevenue),
    platformCommission: readNumber(row.platformCommission),
    last30DaysCommission: readNumber(row.last30DaysCommission),
    top: Array.isArray(row.top)
      ? (row.top as { name: string; count: number }[])
      : [],
  };
}

async function getReportData(): Promise<ReportSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_reports_snapshot");
  if (error) throw error;
  return normalizeReportSnapshot(data);
}

export default async function ReportsPage() {
  const report = await getReportData();
  const maxStatus = Math.max(...Object.values(report.statusCounts), 1);
  const maxTop = Math.max(...report.top.map((t) => t.count), 1);

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Reports</h1>
      <p className="mt-2 text-[var(--muted)]">
        Booking activity uses appointment dates. Payment metrics use settlement dates from
        booking financials.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Total bookings</p>
          <p className="mt-2 text-4xl font-extrabold text-[var(--primary-dark)]">
            {report.total}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Last 30 days bookings</p>
          <p className="mt-2 text-4xl font-extrabold text-[var(--primary-dark)]">
            {report.last30Days}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">By appointment date</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Paid bookings</p>
          <p className="mt-2 text-4xl font-extrabold text-[var(--primary-dark)]">
            {report.paidBookings}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">Platform commission</p>
          <p className="mt-2 text-4xl font-extrabold text-[var(--primary-dark)]">
            ETB {report.platformCommission.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            ETB {report.last30DaysCommission.toLocaleString()} in last 30 days
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] p-6">
          <h2 className="font-bold text-[var(--primary-dark)]">Bookings by status</h2>
          <div className="mt-6 space-y-4">
            {Object.entries(report.statusCounts).map(([status, count]) => (
              <div key={status}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize text-[var(--primary-dark)]">{status}</span>
                  <span className="font-semibold">{count}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${(count / maxStatus) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!Object.keys(report.statusCounts).length ? (
              <p className="text-sm text-[var(--muted)]">No data yet.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] p-6">
          <h2 className="font-bold text-[var(--primary-dark)]">Top businesses by bookings</h2>
          <div className="mt-6 space-y-4">
            {report.top.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-[var(--primary-dark)]">{item.name}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--surface)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]"
                    style={{ width: `${(item.count / maxTop) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!report.top.length ? (
              <p className="text-sm text-[var(--muted)]">No data yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
