import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildChapaCallbackUrl,
  buildChapaReturnUrl,
  chapaCancel,
  chapaMode,
  sanitizeChapaText,
  splitFullName,
  supabaseFunctionsBaseUrl,
} from "./chapa.ts";

export type BookingSplit = {
  commission_rate: number;
  commission_amount_etb: number;
  owner_net_etb: number;
};

export type PreparedBookingPayment = {
  bookingId: string;
  customerId: string;
  businessId: string;
  amount: number;
  txRef: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  serviceLabel: string;
  businessLabel: string;
  split: BookingSplit;
  chapaSubaccountId: string;
  callbackUrl: string;
  returnUrl: string;
};

export class BookingPaymentError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BookingPaymentError";
  }
}

export function makeBookingTxRef(bookingId: string): string {
  const stamp = Date.now().toString(36);
  const shortId = bookingId.replace(/-/g, "").slice(0, 8);
  return `sheger-bkg-${shortId}-${stamp}`;
}

function parseSplit(split: unknown): BookingSplit {
  if (!split || typeof split !== "object") {
    throw new BookingPaymentError("Could not compute payment split", 500);
  }

  const record = split as Record<string, unknown>;
  const commissionRate = Number(record.commission_rate);
  const commissionAmount = Number(record.commission_amount_etb);
  const ownerNet = Number(record.owner_net_etb);

  if (
    !Number.isFinite(commissionRate) ||
    !Number.isFinite(commissionAmount) ||
    !Number.isFinite(ownerNet)
  ) {
    throw new BookingPaymentError("Could not compute payment split", 500);
  }

  return {
    commission_rate: commissionRate,
    commission_amount_etb: commissionAmount,
    owner_net_etb: ownerNet,
  };
}

export async function prepareBookingChapaPayment(
  supabase: SupabaseClient,
  userId: string,
  bookingId: string,
  options?: { txRef?: string; mobileOverride?: string },
): Promise<PreparedBookingPayment> {
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, customer_id, business_id, service_id, payment_status, pricing_model, listed_price, status",
    )
    .eq("id", bookingId)
    .single();

  if (bookingError) throw bookingError;
  if (!booking) throw new BookingPaymentError("Booking not found", 404);
  if (booking.customer_id !== userId) {
    throw new BookingPaymentError("Not authorized for this booking", 403);
  }
  if (booking.status !== "pending") {
    throw new BookingPaymentError("Booking is not payable", 400);
  }
  if (booking.payment_status === "paid") {
    throw new BookingPaymentError("Booking is already paid", 400);
  }
  if (booking.payment_status !== "awaiting_payment") {
    throw new BookingPaymentError("Booking does not require online payment", 400);
  }
  if (booking.pricing_model !== "fixed" || booking.listed_price == null) {
    throw new BookingPaymentError("Only fixed-price services can be paid online", 400);
  }

  const amount = Number(booking.listed_price);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BookingPaymentError("Invalid booking amount", 400);
  }

  const functionsBase = supabaseFunctionsBaseUrl();

  const [{ data: profile }, { data: business }, { data: service }, { data: payoutAccount }, { data: split }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", userId).single(),
      supabase.from("businesses").select("name").eq("id", booking.business_id).single(),
      supabase.from("services").select("name").eq("id", booking.service_id).single(),
      supabase
        .from("business_chapa_subaccounts")
        .select("chapa_subaccount_id, status")
        .eq("business_id", booking.business_id)
        .eq("status", "active")
        .maybeSingle(),
      supabase.rpc("compute_booking_split", {
        p_amount: amount,
        p_business_id: booking.business_id,
      }),
    ]);

  if (!payoutAccount?.chapa_subaccount_id) {
    throw new BookingPaymentError(
      "This business has not set up bank payout details yet. Online payment is unavailable until the owner configures payouts.",
      400,
      "payout_not_configured",
    );
  }

  const parsedSplit = parseSplit(split);
  const { data: authUser } = await supabase.auth.admin.getUserById(userId);
  const email = authUser.user?.email ?? `customer+${userId.slice(0, 8)}@sheger.app`;
  const names = splitFullName(profile?.full_name);
  const txRef = options?.txRef ?? makeBookingTxRef(bookingId);
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const phone = options?.mobileOverride ?? profile?.phone ?? undefined;

  return {
    bookingId,
    customerId: userId,
    businessId: booking.business_id,
    amount,
    txRef,
    email,
    firstName: sanitizeChapaText(names.first_name, "Sheger", 50),
    lastName: sanitizeChapaText(names.last_name, "Customer", 50),
    phone: phone ?? undefined,
    serviceLabel: sanitizeChapaText(service?.name, "Service", 50),
    businessLabel: sanitizeChapaText(business?.name, "Business", 50),
    split: parsedSplit,
    chapaSubaccountId: payoutAccount.chapa_subaccount_id,
    callbackUrl: buildChapaCallbackUrl(functionsBase),
    returnUrl: buildChapaReturnUrl(functionsBase, txRef, anonKey),
  };
}

export async function insertBookingPaymentTransaction(
  supabase: SupabaseClient,
  prepared: PreparedBookingPayment,
  metadata: Record<string, unknown>,
) {
  const { error: insertError } = await supabase.from("payment_transactions").insert({
    purpose: "booking",
    booking_id: prepared.bookingId,
    tx_ref: prepared.txRef,
    amount_etb: prepared.amount,
    currency: "ETB",
    status: "initialized",
    chapa_mode: chapaMode(),
    chapa_subaccount_id: prepared.chapaSubaccountId,
    commission_rate: prepared.split.commission_rate,
    commission_amount_etb: prepared.split.commission_amount_etb,
    owner_net_etb: prepared.split.owner_net_etb,
    metadata: {
      customer_id: prepared.customerId,
      split: prepared.split,
      ...metadata,
    },
  });

  if (insertError) throw insertError;
}

export async function findInitializedBookingTxn(
  supabase: SupabaseClient,
  bookingId: string,
  chargeType?: string,
) {
  const { data: existingTxn } = await supabase
    .from("payment_transactions")
    .select("tx_ref, status, metadata, chapa_subaccount_id, commission_rate, amount_etb")
    .eq("booking_id", bookingId)
    .eq("status", "initialized")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!existingTxn?.tx_ref) return null;

  const meta = existingTxn.metadata as {
    checkout_url?: string;
    charge_type?: string;
    chapa_reference?: string;
    payment_flow?: string;
  } | null;

  if (chargeType && meta?.charge_type && meta.charge_type !== chargeType) {
    return null;
  }

  return {
    txRef: existingTxn.tx_ref,
    metadata: meta,
    chapaSubaccountId: existingTxn.chapa_subaccount_id as string | null,
    commissionRate: existingTxn.commission_rate != null
      ? Number(existingTxn.commission_rate)
      : null,
    amountEtb: Number(existingTxn.amount_etb),
  };
}

/**
 * Reuse a hosted checkout only when payout account, amount, and commission
 * still match what was sent to Chapa (per-transaction split override).
 * @see https://developer.chapa.co/integrations/split-payment
 */
export async function findReusableHostedCheckout(
  supabase: SupabaseClient,
  bookingId: string,
  businessId: string,
  amount: number,
) {
  const txn = await findInitializedBookingTxn(supabase, bookingId);
  const checkoutUrl = txn?.metadata?.checkout_url;
  if (!txn || !checkoutUrl || txn.metadata?.payment_flow === "direct_charge") {
    return null;
  }

  const { data: payout } = await supabase
    .from("business_chapa_subaccounts")
    .select("chapa_subaccount_id")
    .eq("business_id", businessId)
    .eq("status", "active")
    .maybeSingle();

  if (!payout?.chapa_subaccount_id || payout.chapa_subaccount_id !== txn.chapaSubaccountId) {
    return null;
  }

  if (!Number.isFinite(txn.amountEtb) || txn.amountEtb !== amount) {
    return null;
  }

  const { data: split, error: splitError } = await supabase.rpc("compute_booking_split", {
    p_amount: amount,
    p_business_id: businessId,
  });
  if (splitError) throw splitError;

  const currentRate = Number((split as Record<string, unknown> | null)?.commission_rate);
  if (!Number.isFinite(currentRate) || txn.commissionRate !== currentRate) {
    return null;
  }

  return { txRef: txn.txRef, checkoutUrl };
}

/** Cancel stale initialized checkout before creating a new split payment. */
export async function cancelStaleInitializedCheckout(
  supabase: SupabaseClient,
  bookingId: string,
) {
  const txn = await findInitializedBookingTxn(supabase, bookingId);
  if (!txn?.metadata?.checkout_url) return;

  try {
    const result = await chapaCancel(txn.txRef);
    if (!result.cancelled && !result.skipped) {
      console.warn("cancelStaleInitializedCheckout:", txn.txRef, result.reason);
    }
  } catch (error) {
    console.warn("cancelStaleInitializedCheckout:", txn.txRef, error);
  }

  await supabase
    .from("payment_transactions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("booking_id", bookingId)
    .eq("status", "initialized");
}
