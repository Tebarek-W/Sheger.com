import { finalizeVerifiedPayment } from "../_shared/finalize-payment.ts";
import {
  adminClient,
  formatEdgeError,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type VerifyBody = {
  txRef?: string;
};

type TxnMetadata = {
  customer_id?: string;
  business_id?: string;
  booking_draft?: Record<string, unknown>;
};

/**
 * Client-triggered payment verification for both booking and subscription
 * payments.
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
      .select("purpose, booking_id, business_id, status, chapa_reference, payment_method, metadata")
      .eq("tx_ref", txRef)
      .single();

    if (txnError) {
      return jsonResponse({ error: formatEdgeError(txnError, "Payment lookup failed") }, 500);
    }
    if (!txn) return jsonResponse({ error: "Payment not found" }, 404);

    const metadata = txn.metadata as TxnMetadata | null;
    const isSubscription = txn.purpose === "subscription";

    if (isSubscription) {
      const businessId = txn.business_id ?? metadata?.business_id ?? null;
      if (!businessId) return jsonResponse({ error: "Payment not found" }, 404);

      const { data: business } = await supabase
        .from("businesses")
        .select("owner_id")
        .eq("id", businessId)
        .single();
      if (business?.owner_id !== user.id) {
        return jsonResponse({ error: "Not authorized" }, 403);
      }
    } else if (txn.purpose === "booking") {
      if (txn.booking_id) {
        const { data: booking } = await supabase
          .from("bookings")
          .select("customer_id")
          .eq("id", txn.booking_id)
          .single();
        const ownerId = booking?.customer_id ?? metadata?.customer_id ?? null;
        if (!ownerId || ownerId !== user.id) {
          return jsonResponse({ error: "Not authorized" }, 403);
        }
      } else {
        // Deferred booking: row is created in finalize_chapa_payment after verify.
        const customerId = metadata?.customer_id ?? null;
        if (!customerId || customerId !== user.id) {
          return jsonResponse({ error: "Not authorized" }, 403);
        }
        if (!metadata?.booking_draft) {
          return jsonResponse({ error: "Payment not found" }, 404);
        }
      }
    } else {
      return jsonResponse({ error: "Payment not found" }, 404);
    }

    if (txn.status === "success") {
      if (isSubscription) {
        return jsonResponse({
          ok: true,
          purpose: "subscription",
          business_id: txn.business_id ?? metadata?.business_id ?? null,
          payment_status: "paid",
          already_finalized: true,
          chapa_status: "success",
          chapa_reference: txn.chapa_reference ?? null,
          chapa_payment_method: txn.payment_method ?? null,
        });
      }

      return jsonResponse({
        ok: true,
        purpose: "booking",
        booking_id: txn.booking_id,
        payment_status: "paid",
        already_finalized: true,
        chapa_status: "success",
        chapa_reference: txn.chapa_reference ?? null,
        chapa_payment_method: txn.payment_method ?? null,
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

    return jsonResponse({
      ...result,
      purpose: isSubscription ? "subscription" : "booking",
      business_id: isSubscription
        ? (txn.business_id ?? metadata?.business_id ?? null)
        : undefined,
    });
  } catch (error) {
    const message = formatEdgeError(error);
    console.error("chapa-verify:", message, error);
    return jsonResponse({ error: message }, 500);
  }
});
