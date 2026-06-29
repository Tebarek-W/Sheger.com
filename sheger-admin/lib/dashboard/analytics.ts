import "server-only";

import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type { DashboardAnalytics } from "./analytics-shared";

export type {
  DashboardAnalytics,
  DashboardPeriod,
  TimeSeriesPoint,
  TopBusinessRow,
} from "./analytics-shared";
export { formatEtb, periodTotals } from "./analytics-shared";

export async function fetchDashboardAnalytics(): Promise<DashboardAnalytics | null> {
  const { isAdmin } = await getSessionProfile();
  if (!isAdmin) return null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_admin_dashboard_snapshot");
  if (error) throw error;
  return data as DashboardAnalytics | null;
}
