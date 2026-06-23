import { PlanManager } from "@/components/admin/PlanManager";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SubscriptionPlan } from "@/lib/types/database";

export default async function PlansPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("sort_order", { ascending: true });

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

  return (
    <div>
      <h1 className="text-3xl font-bold text-[var(--primary-dark)]">Subscription plans</h1>
      <p className="mt-2 text-[var(--muted)]">
        Create and manage plans (Free, Basic, Premium, etc.). Businesses choose a plan and
        automatically receive its service and booking limits.
      </p>
      <PlanManager plans={(data ?? []) as SubscriptionPlan[]} />
    </div>
  );
}
