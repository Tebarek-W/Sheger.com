import { supabase } from "@/lib/supabase";
import type {
  BillingInterval,
  SubscriptionPayment,
  SubscriptionPlan,
  SubscriptionSummary,
} from "@/lib/types/database";

export async function fetchSubscriptionSummary(businessId: string): Promise<SubscriptionSummary> {
  const { data, error } = await supabase.rpc("get_subscription_summary", {
    p_business_id: businessId,
  });

  if (error) throw error;
  return data as SubscriptionSummary;
}

export async function fetchSubscriptionPayments(businessId: string) {
  const { data, error } = await supabase
    .from("subscription_payments")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as SubscriptionPayment[];
}

export async function selectSubscriptionPlan(
  businessId: string,
  planId: string,
  billingInterval: BillingInterval,
  paymentMethod: string,
) {
  const { data, error } = await supabase.rpc("record_subscription_payment", {
    p_business_id: businessId,
    p_plan_id: planId,
    p_billing_interval: billingInterval,
    p_payment_method: paymentMethod,
  });

  if (error) throw error;
  return data as {
    subscription: SubscriptionSummary["subscription"];
    plan: SubscriptionPlan;
    payment_id: string;
    reference_code: string;
    amount_etb: number;
  };
}
