import { chapaCancel, chapaVerify, isChapaSuccessfulStatus } from "../_shared/chapa.ts";
import { finalizeVerifiedPayment } from "../_shared/finalize-payment.ts";
import {
  adminClient,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type CancelBody = {
  txRef?: string;
  bookingId?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user } = await requireUser(req);
    const body = (await req.json()) as CancelBody;
    const txRef = body.txRef?.trim();
    const bookingId = body.bookingId?.trim();

    if (!txRef && !bookingId) {
      return jsonResponse({ error: "txRef or bookingId is required" }, 400);
    }

    const supabase = adminClient();

    let txnQuery = supabase
      .from("payment_transactions")
      .select("id, tx_ref, booking_id, business_id, purpose, status, metadata")
      .in("status", ["initialized", "failed"]);

    if (txRef) {
      txnQuery = txnQuery.eq("tx_ref", txRef);
    } else {
      txnQuery = txnQuery.eq("booking_id", bookingId!);
    }

    const { data: txn, error: txnError } = await txnQuery.maybeSingle();
    if (txnError) throw txnError;
    if (!txn) {
      return jsonResponse({ ok: true, skipped: true, reason: "no active transaction" });
    }

    // Authorize: booking customer, draft owner, or subscription business owner.
    let booking:
      | { id: string; customer_id: string; status: string; payment_status: string }
      | null = null;

    if (txn.purpose === "subscription") {
      const businessId =
        txn.business_id ??
        (txn.metadata as { business_id?: string } | null)?.business_id ??
        null;
      if (!businessId) {
        return jsonResponse({ error: "Not authorized" }, 403);
      }
      const { data: business } = await supabase
        .from("businesses")
        .select("owner_id")
        .eq("id", businessId)
        .single();
      if (business?.owner_id !== user.id) {
        return jsonResponse({ error: "Not authorized" }, 403);
      }
    } else if (txn.booking_id) {
      const { data: bookingRow, error: bookingError } = await supabase
        .from("bookings")
        .select("id, customer_id, status, payment_status")
        .eq("id", txn.booking_id)
        .single();

      if (bookingError) throw bookingError;
      booking = bookingRow;
      if (booking.customer_id !== user.id) {
        return jsonResponse({ error: "Not authorized" }, 403);
      }
    } else {
      const meta = txn.metadata as { customer_id?: string } | null;
      if (!meta?.customer_id || meta.customer_id !== user.id) {
        return jsonResponse({ error: "Not authorized" }, 403);
      }
    }

    // If payment already succeeded on Chapa, finalize instead of cancelling.
    // For drafts this also creates the booking. @see finalize_chapa_payment
    try {
      const verified = await chapaVerify(txn.tx_ref);
      if (isChapaSuccessfulStatus(verified.status)) {
        const paid = await finalizeVerifiedPayment(txn.tx_ref);
        if (paid.ok) {
          return jsonResponse({
            ok: true,
            paid: true,
            booking_id: paid.booking_id,
            payment_status: paid.payment_status,
            already_finalized: paid.already_finalized,
          });
        }
      }
    } catch (verifyError) {
      console.warn("chapa-cancel verify:", verifyError);
    }

    if (txn.status === "initialized") {
      const chapaResult = await chapaCancel(txn.tx_ref);
      if (!chapaResult.cancelled && !chapaResult.skipped) {
        throw new Error(chapaResult.reason ?? "Could not cancel Chapa transaction");
      }

      await supabase
        .from("payment_transactions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", txn.id);
    }

    if (
      booking &&
      booking.status === "pending" &&
      booking.payment_status === "awaiting_payment"
    ) {
      await supabase
        .from("bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", booking.id);
    }

    return jsonResponse({
      ok: true,
      booking_id: booking?.id ?? null,
      cancelled: true,
      chapa_checkout_expired: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-cancel:", message);
    return jsonResponse({ error: message }, 500);
  }
});
