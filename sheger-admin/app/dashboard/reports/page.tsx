import { createClient } from "@/lib/supabase/server";

async function getReportData() {
  const supabase = await createClient();

  const [byStatus, recent, topBusinesses] = await Promise.all([
    supabase.from("bookings").select("status"),
    supabase
      .from("bookings")
      .select("created_at")
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      ),
    supabase
      .from("bookings")
      .select("business_id, businesses(name)")
      .limit(500),
  ]);

  const statusCounts: Record<string, number> = {};
  (byStatus.data ?? []).forEach((row) => {
    statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1;
  });

  const businessCounts: Record<string, { name: string; count: number }> = {};
  (topBusinesses.data ?? []).forEach((row) => {
    const name =
      (row.businesses as { name: string } | null)?.name ?? "Unknown";
    const key = row.business_id;
    if (!businessCounts[key]) {
      businessCounts[key] = { name, count: 0 };
    }
    businessCounts[key].count += 1;
  });

  const top = Object.values(businessCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    statusCounts,
    last30Days: recent.data?.length ?? 0,
    top,
    total: byStatus.data?.length ?? 0,
  };
}

export default async function ReportsPage() {
  const report = await getReportData();
  const maxStatus = Math.max(...Object.values(report.statusCounts), 1);
  const maxTop = Math.max(...report.top.map((t) => t.count), 1);

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Reports</h1>
      <p className="mt-2 text-[var(--muted)]">
        Booking activity and platform health at a glance.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">
            Total bookings
          </p>
          <p className="mt-2 text-4xl font-extrabold text-[var(--primary-dark)]">
            {report.total}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm font-semibold text-[var(--muted)]">
            Last 30 days
          </p>
          <p className="mt-2 text-4xl font-extrabold text-[var(--primary-dark)]">
            {report.last30Days}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] p-6">
          <h2 className="font-bold text-[var(--primary-dark)]">
            Bookings by status
          </h2>
          <div className="mt-6 space-y-4">
            {Object.entries(report.statusCounts).map(([status, count]) => (
              <div key={status}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="capitalize text-[var(--primary-dark)]">
                    {status}
                  </span>
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
          <h2 className="font-bold text-[var(--primary-dark)]">
            Top businesses by bookings
          </h2>
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
