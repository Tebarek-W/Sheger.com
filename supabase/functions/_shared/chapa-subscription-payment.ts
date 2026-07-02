import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildChapaCallbackUrl,
  buildChapaReturnUrl,
  chapaMode,
  sanitizeChapaText,
  splitFullName,
  supabaseFunctionsBaseUrl,
} from "./chapa.ts";

export type BillingInterval = "monthly" | "yearly";

export type PreparedSubscriptionPayment = {
  businessId: string;
  ownerId: string;
  planId: string;
  planName: string;
  billingInterval: BillingInterval;
  amount: number;
  txRef: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  callbackUrl: string;
  returnUrl: string;
};

export class SubscriptionPaymentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = "SubscriptionPaymentError";
  }
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "yearly";
}

export function makeSubscriptionTxRef(businessId: string): string {
  const stamp = Date.now().toString(36);
  const shortId = businessId.replace(/-/g, "").slice(0, 8);
  return `sheger-sub-${shortId}-${stamp}`;
}

export async function prepareSubscriptionChapaPayment(
  supabase: SupabaseClient,
  userId: string,
  businessId: string,
  planId: string,
  billingInterval: BillingInterval,
  options?: { txRef?: string; mobileOverride?: string },
): Promise<PreparedSubscriptionPayment> {
  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, owner_id, name")
    .eq("id", businessId)
    .single();

  if (businessError) throw businessError;
  if (!business) throw new SubscriptionPaymentError("Business not found", 404);
  if (business.owner_id !== userId) {
    throw new SubscriptionPaymentError("Not authorized for this business", 403);
  }

  const { data: plan, error: planError } = await supabase
    .from("subscription_plans")
    .select("id, name, monthly_fee_etb, yearly_fee_etb, is_active")
    .eq("id", planId)
    .single();

  if (planError) throw planError;
  if (!plan || plan.is_active === false) {
    throw new SubscriptionPaymentError("Selected plan is not available", 400);
  }

  const amount = Number(
    billingInterval === "yearly" ? plan.yearly_fee_etb : plan.monthly_fee_etb,
  );

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new SubscriptionPaymentError(
      "This plan is free — no online payment is required.",
      400,
      "free_plan",
    );
  }

  const functionsBase = supabaseFunctionsBaseUrl();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const txRef = options?.txRef ?? makeSubscriptionTxRef(businessId);

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", userId).single(),
    supabase.auth.admin.getUserById(userId),
  ]);

  const email = authUser.user?.email ?? `owner+${userId.slice(0, 8)}@sheger.app`;
  const names = splitFullName(profile?.full_name);
  const phone = options?.mobileOverride ?? profile?.phone ?? undefined;

  return {
    businessId,
    ownerId: userId,
    planId: plan.id,
    planName: sanitizeChapaText(plan.name, "Plan", 50),
    billingInterval,
    amount,
    txRef,
    email,
    firstName: sanitizeChapaText(names.first_name, "Sheger", 50),
    lastName: sanitizeChapaText(names.last_name, "Owner", 50),
    phone: phone ?? undefined,
    callbackUrl: buildChapaCallbackUrl(functionsBase),
    returnUrl: buildChapaReturnUrl(functionsBase, txRef, anonKey),
  };
}

export async function insertSubscriptionPaymentTransaction(
  supabase: SupabaseClient,
  prepared: PreparedSubscriptionPayment,
  metadata: Record<string, unknown>,
) {
  const { error: insertError } = await supabase.from("payment_transactions").insert({
    purpose: "subscription",
    business_id: prepared.businessId,
    tx_ref: prepared.txRef,
    amount_etb: prepared.amount,
    currency: "ETB",
    status: "initialized",
    chapa_mode: chapaMode(),
    metadata: {
      business_id: prepared.businessId,
      owner_id: prepared.ownerId,
      plan_id: prepared.planId,
      billing_interval: prepared.billingInterval,
      ...metadata,
    },
  });

  if (insertError) throw insertError;
}
