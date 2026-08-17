import {
  BookingPaymentError,
  attachHostedCheckoutToTransaction,
  cancelStaleDraftCheckouts,
  cancelStaleInitializedCheckout,
  chapaInitializeBookingWithSplit,
  findReusableHostedCheckout,
  insertBookingDraftPaymentTransaction,
  insertBookingPaymentTransaction,
  prepareBookingChapaPayment,
  prepareBookingDraftChapaPayment,
  rollbackUnattachedCheckout,
  SLOT_HOLD_TTL_SECONDS,
  type BookingDraftInput,
  type PreparedBookingDraftPayment,
  type PreparedBookingPayment,
} from "../_shared/chapa-booking-payment.ts";
import {
  buildChapaReturnUrl,
  chapaCancel,
  formatChapaAmount,
  normalizeChapaPhone,
  supabaseFunctionsBaseUrl,
} from "../_shared/chapa.ts";
import {
  adminClient,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type InitializeBody = {
  /** Legacy flow: booking already exists (payment_status = awaiting_payment). */
  bookingId?: string;
  /** Deferred flow: booking is created only after payment succeeds. */
  draft?: BookingDraftInput;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user } = await requireUser(req);
    const body = (await req.json()) as InitializeBody;
    const bookingId = body.bookingId?.trim();
    const draft = body.draft;

    if (!bookingId && !draft) {
      return jsonResponse({ error: "bookingId or draft is required" }, 400);
    }

    const supabase = adminClient();
    const functionsBase = supabaseFunctionsBaseUrl();
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    let prepared: PreparedBookingPayment | PreparedBookingDraftPayment;
    let isDraft = false;

    if (draft) {
      // Deferred flow — no booking row yet; validate, then create a fresh
      // checkout after clearing any abandoned drafts for this customer.
      isDraft = true;
      await cancelStaleDraftCheckouts(supabase, user.id);
      prepared = await prepareBookingDraftChapaPayment(supabase, user.id, draft);
    } else {
      const { data: bookingRow, error: bookingRowError } = await supabase
        .from("bookings")
        .select("business_id, listed_price")
        .eq("id", bookingId!)
        .single();

      if (bookingRowError || !bookingRow) {
        return jsonResponse({ error: "Booking not found" }, 404);
      }

      const amount = Number(bookingRow.listed_price);
      const reusable = await findReusableHostedCheckout(
        supabase,
        bookingId!,
        bookingRow.business_id,
        amount,
      );
      if (reusable) {
        return jsonResponse({
          checkout_url: reusable.checkoutUrl,
          tx_ref: reusable.txRef,
          return_url: buildChapaReturnUrl(functionsBase, reusable.txRef, anonKey),
          reused: true,
        });
      }

      await cancelStaleInitializedCheckout(supabase, bookingId!);
      prepared = await prepareBookingChapaPayment(supabase, user.id, bookingId!);
    }

    let holdExpiresAt: string | null = null;
    if (isDraft) {
      const draftResult = await insertBookingDraftPaymentTransaction(
        supabase,
        prepared as PreparedBookingDraftPayment,
        { payment_flow: "hosted_checkout" },
      );
      holdExpiresAt = draftResult.holdExpiresAt;
    } else {
      await insertBookingPaymentTransaction(
        supabase,
        prepared as PreparedBookingPayment,
        { payment_flow: "hosted_checkout" },
      );
    }

    let initResult: { checkout_url: string; split_mode: string };
    try {
      initResult = await chapaInitializeBookingWithSplit(
        {
          amount: formatChapaAmount(prepared.amount),
          currency: "ETB",
          email: prepared.email,
          first_name: prepared.firstName,
          last_name: prepared.lastName,
          tx_ref: prepared.txRef,
          phone_number: normalizeChapaPhone(prepared.phone),
          callback_url: prepared.callbackUrl,
          return_url: prepared.returnUrl,
          customization: {
            title: "ABORA",
            description: `${prepared.serviceLabel} at ${prepared.businessLabel}`,
          },
          meta: {
            booking_id: isDraft ? null : (prepared as PreparedBookingPayment).bookingId,
            customer_id: prepared.customerId,
            purpose: "booking",
            payment_reason: `ABORA booking — ${prepared.serviceLabel}`,
            invoices: [
              { key: prepared.serviceLabel, value: "1 appointment" },
              { key: prepared.businessLabel, value: formatChapaAmount(prepared.amount) + " ETB" },
            ],
            split: {
              commission_rate: prepared.split.commission_rate,
              commission_amount_etb: prepared.split.commission_amount_etb,
              owner_net_etb: prepared.split.owner_net_etb,
              chapa_subaccount_id: prepared.chapaSubaccountId,
            },
          },
        },
        prepared.split,
        prepared.chapaSubaccountId,
      );
    } catch (initError) {
      await rollbackUnattachedCheckout(supabase, prepared.txRef);
      throw initError;
    }

    try {
      await attachHostedCheckoutToTransaction(supabase, prepared, initResult);
    } catch (attachError) {
      await rollbackUnattachedCheckout(supabase, prepared.txRef);
      try {
        await chapaCancel(prepared.txRef);
      } catch (cancelError) {
        console.warn("chapa-initialize attach rollback:", prepared.txRef, cancelError);
      }
      throw attachError;
    }

    return jsonResponse({
      checkout_url: initResult.checkout_url,
      tx_ref: prepared.txRef,
      return_url: prepared.returnUrl,
      ...(isDraft
        ? {
            hold_expires_at: holdExpiresAt,
            hold_ttl_seconds: SLOT_HOLD_TTL_SECONDS,
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof BookingPaymentError) {
      return jsonResponse(
        { error: error.message, code: error.code },
        error.status,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-initialize:", message);
    return jsonResponse({ error: message }, 500);
  }
});
