import { PlanManager } from "@/components/admin/PlanManager";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan } from "@/lib/types/database";

export default async function PlansPage() {
  const supabase = createAdminClient();
  const [{ data, error }, { data: settings }] = await Promise.all([
    supabase.from("subscription_plans").select("*").order("sort_order", { ascending: true }),
    supabase
      .from("platform_settings")
      .select("default_booking_commission_rate")
      .eq("id", 1)
      .maybeSingle(),
  ]);

  if (error) {
    return (
      <div>
        <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Subscription plans</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Plans are unavailable until migration{" "}
          <code className="font-mono text-xs">20250625000001_business_subscriptions.sql</code>{" "}
          is applied.
        </p>
      </div>
    );
  }

  const defaultCommissionRate = Number(settings?.default_booking_commission_rate ?? 0.1);

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Subscription plans</h1>
      <p className="mt-2 text-[var(--muted)]">
        Manage subscription plans and the platform commission rate on each online booking. Businesses
        on a plan use that plan&apos;s commission; others use the default rate.
      </p>
      <PlanManager
        plans={(data ?? []) as SubscriptionPlan[]}
        defaultCommissionRate={defaultCommissionRate}
      />
    </div>
  );
}
