import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildChapaCallbackUrl,
  buildChapaReturnUrl,
  chapaCancel,
  chapaDirectCharge,
  chapaInitialize,
  chapaMode,
  sanitizeChapaText,
  splitFullName,
  supabaseFunctionsBaseUrl,
  type ChapaDirectChargeResult,
  type ChapaDirectChargeType,
  type ChapaSplitSubaccount,
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

/** Booking details captured before payment — no `bookings` row exists yet. */
export type BookingDraftInput = {
  businessId: string;
  serviceId: string;
  employeeId?: string | null;
  scheduledAt: string;
};

/** Persisted on the payment transaction so finalize can create the booking. */
export type BookingDraft = {
  customer_id: string;
  business_id: string;
  service_id: string;
  employee_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  payment_method: string;
};

export type PreparedBookingDraftPayment = Omit<PreparedBookingPayment, "bookingId"> & {
  draft: BookingDraft;
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

/** Matches Chapa hosted-checkout lifetime and expire-unpaid-bookings cutoff. */
export const SLOT_HOLD_TTL_SECONDS = 15 * 60;

/** Recorded settlement when Chapa could not run an automatic subaccount split. */
export function settlementForSplitMode(
  split: BookingSplit,
  amountEtb: number,
  splitMode: string,
): BookingSplit {
  if (splitMode === "merchant_only") {
    const amount = Math.round(amountEtb * 100) / 100;
    return {
      commission_rate: 1,
      commission_amount_etb: amount,
      owner_net_etb: 0,
    };
  }
  return split;
}

export function makeBookingTxRef(bookingId: string): string {
  const stamp = Date.now().toString(36);
  const shortId = bookingId.replace(/-/g, "").slice(0, 8);
  return `sheger-bkg-${shortId}-${stamp}`;
}

/** No booking id exists yet for deferred bookings, so use a random suffix. */
export function makeDraftTxRef(): string {
  const stamp = Date.now().toString(36);
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `sheger-bkg-${rand}-${stamp}`;
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

/** Platform commission as a percentage (0–1). Chapa supports split from 1 ETB. @see https://developer.chapa.co/integrations/split-payment */
export function buildBookingChapaSubaccountSplit(
  split: BookingSplit,
  chapaSubaccountId: string,
): ChapaSplitSubaccount {
  return {
    id: chapaSubaccountId,
    split_type: "percentage",
    split_value: split.commission_rate,
  };
}

/** Chapa processing fee estimate used for split viability (6% with 6 ETB floor). */
export function estimateChapaProcessingFeeEtb(amountEtb: number): number {
  const amount = Math.max(Number(amountEtb) || 0, 0);
  return Math.max(6, Math.ceil(amount * 0.06 * 100) / 100);
}

export function isAutoSplitViable(amountEtb: number, commissionRate: number): boolean {
  const amount = Math.max(Number(amountEtb) || 0, 0);
  const rate = Number(commissionRate);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(rate) || rate < 0) {
    return false;
  }
  const commission = Math.round(amount * rate * 100) / 100;
  return commission >= estimateChapaProcessingFeeEtb(amount);
}

function isChapaSplitRejection(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("split_value") ||
    lower.includes("subaccounts") ||
    lower.includes("transaction fee") ||
    lower.includes("split payment") ||
    lower.includes("merchant fee") ||
    lower.includes("merchant's share")
  );
}

type BookingInitializePayload = Omit<Parameters<typeof chapaInitialize>[0], "subaccounts">;

/**
 * Initialize hosted checkout with Chapa split payment. If Chapa rejects the
 * split (platform commission too small to cover their fee on this amount), fall
 * back to subaccount defaults then merchant-only settlement so checkout opens.
 * @see https://developer.chapa.co/integrations/split-payment
 */
export async function chapaInitializeBookingWithSplit(
  payload: BookingInitializePayload,
  split: BookingSplit,
  chapaSubaccountId: string,
): Promise<{ checkout_url: string; split_mode: string }> {
  const attempts: Array<{ mode: string; subaccounts?: ChapaSplitSubaccount }> = [
    {
      mode: "percentage_override",
      subaccounts: buildBookingChapaSubaccountSplit(split, chapaSubaccountId),
    },
    { mode: "subaccount_default", subaccounts: { id: chapaSubaccountId } },
    { mode: "merchant_only" },
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const initPayload = attempt.subaccounts
        ? { ...payload, subaccounts: attempt.subaccounts }
        : payload;
      const result = await chapaInitialize(initPayload);
      return { checkout_url: result.checkout_url, split_mode: attempt.mode };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isChapaSplitRejection(lastError.message)) {
        throw lastError;
      }
      console.warn("chapaInitializeBookingWithSplit:", attempt.mode, lastError.message);
    }
  }

  throw lastError ?? new Error("Chapa initialize failed");
}

type BookingDirectChargePayload = Omit<
  Parameters<typeof chapaDirectCharge>[1],
  "subaccounts"
>;

/** Same split fallback chain as hosted checkout, for direct wallet charges. */
export async function chapaDirectChargeBookingWithSplit(
  chargeType: ChapaDirectChargeType,
  payload: BookingDirectChargePayload,
  split: BookingSplit,
  chapaSubaccountId: string,
): Promise<{ result: ChapaDirectChargeResult; split_mode: string }> {
  const attempts: Array<{ mode: string; subaccounts?: ChapaSplitSubaccount }> = [
    {
      mode: "percentage_override",
      subaccounts: buildBookingChapaSubaccountSplit(split, chapaSubaccountId),
    },
    { mode: "subaccount_default", subaccounts: { id: chapaSubaccountId } },
    { mode: "merchant_only" },
  ];

  let lastError: Error | null = null;

  for (const attempt of attempts) {
    try {
      const chargePayload = attempt.subaccounts
        ? { ...payload, subaccounts: attempt.subaccounts }
        : payload;
      const result = await chapaDirectCharge(chargeType, chargePayload);
      return { result, split_mode: attempt.mode };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!isChapaSplitRejection(lastError.message)) {
        throw lastError;
      }
      console.warn("chapaDirectChargeBookingWithSplit:", attempt.mode, lastError.message);
    }
  }

  throw lastError ?? new Error("Chapa direct charge failed");
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

/**
 * Prepare a Chapa payment for a booking that has NOT been created yet. The
 * booking is only inserted after payment succeeds (see finalize_chapa_payment).
 * Validation mirrors the booking insert trigger via validate_booking_draft.
 */
export async function prepareBookingDraftChapaPayment(
  supabase: SupabaseClient,
  userId: string,
  input: BookingDraftInput,
): Promise<PreparedBookingDraftPayment> {
  const scheduledAt = input.scheduledAt?.trim();
  if (!input.businessId || !input.serviceId || !scheduledAt) {
    throw new BookingPaymentError("Incomplete booking details", 400);
  }

  const employeeId = input.employeeId?.trim() || null;

  const { data: validation, error: validationError } = await supabase.rpc(
    "validate_booking_draft",
    {
      p_customer_id: userId,
      p_business_id: input.businessId,
      p_service_id: input.serviceId,
      p_employee_id: employeeId,
      p_scheduled_at: scheduledAt,
    },
  );

  if (validationError) {
    throw new BookingPaymentError(
      validationError.message ?? "This booking is no longer available",
      400,
    );
  }

  const validated = validation as {
    listed_price?: number;
    duration_minutes?: number;
  } | null;

  const amount = Number(validated?.listed_price);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new BookingPaymentError("Invalid booking amount", 400);
  }
  const durationMinutes = Number(validated?.duration_minutes) || 30;

  const functionsBase = supabaseFunctionsBaseUrl();

  const [{ data: profile }, { data: business }, { data: service }, { data: payoutAccount }, { data: split }] =
    await Promise.all([
      supabase.from("profiles").select("full_name, phone").eq("id", userId).single(),
      supabase.from("businesses").select("name").eq("id", input.businessId).single(),
      supabase.from("services").select("name").eq("id", input.serviceId).single(),
      supabase
        .from("business_chapa_subaccounts")
        .select("chapa_subaccount_id, status")
        .eq("business_id", input.businessId)
        .eq("status", "active")
        .maybeSingle(),
      supabase.rpc("compute_booking_split", {
        p_amount: amount,
        p_business_id: input.businessId,
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
  const txRef = makeDraftTxRef();
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const phone = profile?.phone ?? undefined;

  return {
    customerId: userId,
    businessId: input.businessId,
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
    draft: {
      customer_id: userId,
      business_id: input.businessId,
      service_id: input.serviceId,
      employee_id: employeeId,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      payment_method: "chapa",
    },
  };
}

export async function insertBookingDraftPaymentTransaction(
  supabase: SupabaseClient,
  prepared: PreparedBookingDraftPayment,
  metadata: Record<string, unknown>,
): Promise<{ paymentTxId: string; holdExpiresAt: string | null }> {
  const { data: inserted, error: insertError } = await supabase
    .from("payment_transactions")
    .insert({
      purpose: "booking",
      booking_id: null,
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
        booking_draft: prepared.draft,
        ...metadata,
      },
    })
    .select("id")
    .single();

  if (insertError) throw insertError;
  if (!inserted?.id) throw new Error("Payment transaction insert returned no id");

  const { data: hold, error: holdError } = await supabase.rpc("create_booking_slot_hold", {
    p_payment_tx_id: inserted.id,
  });

  if (holdError) {
    // Roll back the draft txn so we don't leave a checkout without a lock.
    await supabase
      .from("payment_transactions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", inserted.id);
    try {
      await chapaCancel(prepared.txRef);
    } catch (cancelError) {
      console.warn("create_booking_slot_hold rollback chapa:", prepared.txRef, cancelError);
    }
    throw new BookingPaymentError(
      holdError.message ?? "This time slot is no longer available",
      409,
      "slot_unavailable",
    );
  }

  const holdRecord = hold as { expires_at?: string } | null;

  return {
    paymentTxId: inserted.id,
    holdExpiresAt: holdRecord?.expires_at ?? null,
  };
}

export async function attachHostedCheckoutToTransaction(
  supabase: SupabaseClient,
  prepared: PreparedBookingPayment | PreparedBookingDraftPayment,
  initResult: { checkout_url: string; split_mode: string },
) {
  const settled = settlementForSplitMode(
    prepared.split,
    prepared.amount,
    initResult.split_mode,
  );

  const { data: existing, error: readError } = await supabase
    .from("payment_transactions")
    .select("id, metadata")
    .eq("tx_ref", prepared.txRef)
    .eq("status", "initialized")
    .maybeSingle();

  if (readError) throw readError;
  if (!existing?.id) {
    throw new Error("Payment transaction missing after checkout initialize");
  }

  const previous = (existing.metadata as Record<string, unknown> | null) ?? {};

  const { error: updateError } = await supabase
    .from("payment_transactions")
    .update({
      commission_rate: settled.commission_rate,
      commission_amount_etb: settled.commission_amount_etb,
      owner_net_etb: settled.owner_net_etb,
      metadata: {
        ...previous,
        checkout_url: initResult.checkout_url,
        payment_flow: "hosted_checkout",
        split_mode: initResult.split_mode,
        split: settled,
        planned_split: prepared.split,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (updateError) throw updateError;
}

export async function rollbackUnattachedCheckout(
  supabase: SupabaseClient,
  txRef: string,
) {
  await supabase
    .from("payment_transactions")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("tx_ref", txRef)
    .eq("status", "initialized");
}

/**
 * A customer only checks out one booking at a time. Cancel any prior initialized
 * draft checkouts for them (on Chapa + locally) before opening a new one, so
 * abandoned checkouts don't linger as live Chapa links.
 */
export async function cancelStaleDraftCheckouts(
  supabase: SupabaseClient,
  customerId: string,
) {
  const { data: staleTxns } = await supabase
    .from("payment_transactions")
    .select("id, tx_ref")
    .eq("purpose", "booking")
    .is("booking_id", null)
    .eq("status", "initialized")
    .eq("metadata->>customer_id", customerId);

  for (const stale of staleTxns ?? []) {
    if (!stale.tx_ref) continue;
    try {
      const result = await chapaCancel(stale.tx_ref);
      if (!result.cancelled && !result.skipped) {
        console.warn("cancelStaleDraftCheckouts:", stale.tx_ref, result.reason);
      }
    } catch (error) {
      console.warn("cancelStaleDraftCheckouts:", stale.tx_ref, error);
    }

    await supabase
      .from("payment_transactions")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", stale.id);
  }
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
