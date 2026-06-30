import {
  chapaAuthorizeDirectCharge,
  isChapaDirectChargeType,
} from "../_shared/chapa.ts";
import {
  adminClient,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type AuthorizeBody = {
  txRef?: string;
  chargeType?: string;
  reference?: string;
  client?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user } = await requireUser(req);
    const body = (await req.json()) as AuthorizeBody;
    const txRef = body.txRef?.trim();
    const chargeType = body.chargeType?.trim().toLowerCase() ?? "";
    const reference = body.reference?.trim();
    const client = body.client?.trim() ?? "";

    if (!txRef) {
      return jsonResponse({ error: "txRef is required" }, 400);
    }
    if (!isChapaDirectChargeType(chargeType)) {
      return jsonResponse({ error: "A valid chargeType is required" }, 400);
    }

    const supabase = adminClient();
    const { data: txn, error: txnError } = await supabase
      .from("payment_transactions")
      .select("booking_id, metadata, status")
      .eq("tx_ref", txRef)
      .single();

    if (txnError) throw txnError;
    if (!txn) return jsonResponse({ error: "Payment not found" }, 404);

    const metadata = txn.metadata as {
      customer_id?: string;
      chapa_reference?: string;
      charge_type?: string;
    } | null;

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

    const chapaReference = reference ?? metadata?.chapa_reference;
    if (!chapaReference) {
      return jsonResponse({ error: "reference is required" }, 400);
    }

    const result = await chapaAuthorizeDirectCharge(chargeType, {
      reference: chapaReference,
      client,
    });

    return jsonResponse({
      ok: true,
      status: result.status,
      tx_ref: result.trx_ref ?? txRef,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-authorize:", message);
    return jsonResponse({ error: message }, 500);
  }
});
