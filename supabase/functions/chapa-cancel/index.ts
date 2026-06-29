import { chapaCancel } from "../_shared/chapa.ts";
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
      .select("id, tx_ref, booking_id, status")
      .eq("status", "initialized");

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

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id, customer_id, status, payment_status")
      .eq("id", txn.booking_id)
      .single();

    if (bookingError) throw bookingError;
    if (booking.customer_id !== user.id) {
      return jsonResponse({ error: "Not authorized" }, 403);
    }

    if (txn.status === "initialized") {
      try {
        await chapaCancel(txn.tx_ref);
      } catch (cancelError) {
        console.warn("chapa-cancel api:", cancelError);
      }

      await supabase
        .from("payment_transactions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", txn.id);
    }

    if (
      booking.status === "pending" &&
      booking.payment_status === "awaiting_payment"
    ) {
      await supabase
        .from("bookings")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", booking.id);
    }

    return jsonResponse({ ok: true, booking_id: booking.id, cancelled: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-cancel:", message);
    return jsonResponse({ error: message }, 500);
  }
});
