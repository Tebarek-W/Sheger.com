import { finalizeVerifiedPayment } from "../_shared/finalize-payment.ts";
import {
  adminClient,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type VerifyBody = {
  txRef?: string;
};

/**
 * Client-triggered payment verification.
 * @see https://developer.chapa.co/integrations/verify-payments
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user } = await requireUser(req);
    const body = (await req.json()) as VerifyBody;
    const txRef = body.txRef?.trim();

    if (!txRef) {
      return jsonResponse({ error: "txRef is required" }, 400);
    }

    const supabase = adminClient();
    const { data: txn, error: txnError } = await supabase
      .from("payment_transactions")
      .select("booking_id, status, metadata")
      .eq("tx_ref", txRef)
      .single();

    if (txnError) throw txnError;
    if (!txn?.booking_id) return jsonResponse({ error: "Payment not found" }, 404);

    const metadata = txn.metadata as { customer_id?: string } | null;
    if (metadata?.customer_id && metadata.customer_id !== user.id) {
      const { data: booking } = await supabase
        .from("bookings")
        .select("customer_id")
        .eq("id", txn.booking_id)
        .single();
      if (booking?.customer_id !== user.id) {
        return jsonResponse({ error: "Not authorized" }, 403);
      }
    }

    if (txn.status === "success") {
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, payment_status")
        .eq("id", txn.booking_id)
        .single();

      return jsonResponse({
        ok: true,
        booking_id: txn.booking_id,
        payment_status: booking?.payment_status ?? "paid",
        already_finalized: true,
        chapa_status: "success",
      });
    }

    if (txn.status === "cancelled") {
      return jsonResponse({ ok: false, status: "cancelled" }, 410);
    }

    const result = await finalizeVerifiedPayment(txRef);

    if (!result.ok) {
      return jsonResponse({
        ok: false,
        status: result.status,
        chapa_status: result.status,
        chapa_reference: result.chapa_reference ?? null,
        chapa_payment_method: result.chapa_payment_method ?? null,
      }, result.status === "pending" ? 202 : 402);
    }

    return jsonResponse(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-verify:", message);
    return jsonResponse({ error: message }, 500);
  }
});
