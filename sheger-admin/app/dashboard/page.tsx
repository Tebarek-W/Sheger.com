import { DashboardCharts } from "@/components/admin/DashboardCharts";
import { fetchDashboardAnalytics } from "@/lib/dashboard/analytics";

export default async function DashboardPage() {
  const analytics = await fetchDashboardAnalytics();

  if (!analytics) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Dashboard</h1>
        <p className="mt-4 text-[var(--muted)]">Admin access required.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Dashboard</h1>
      <p className="mt-2 text-[var(--muted)]">
        Platform performance with daily, weekly, monthly, and yearly views.
      </p>

      <DashboardCharts data={analytics} />
    </div>
  );
}
