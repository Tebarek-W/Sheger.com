import {
  BookingPaymentError,
  findInitializedBookingTxn,
  insertBookingPaymentTransaction,
  prepareBookingChapaPayment,
} from "../_shared/chapa-booking-payment.ts";
import {
  chapaDirectCharge,
  formatChapaAmount,
  isChapaDirectChargeType,
  normalizeChapaPhone,
} from "../_shared/chapa.ts";
import {
  adminClient,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type ChargeBody = {
  bookingId?: string;
  chargeType?: string;
  mobile?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user } = await requireUser(req);
    const body = (await req.json()) as ChargeBody;
    const bookingId = body.bookingId?.trim();
    const chargeType = body.chargeType?.trim().toLowerCase() ?? "";
    const mobileInput = body.mobile?.trim() ?? "";

    if (!bookingId) {
      return jsonResponse({ error: "bookingId is required" }, 400);
    }
    if (!isChapaDirectChargeType(chargeType)) {
      return jsonResponse({ error: "A valid chargeType is required" }, 400);
    }

    const mobile = normalizeChapaPhone(mobileInput);
    if (!mobile) {
      return jsonResponse(
        { error: "A valid mobile number is required (09xxxxxxxx or 07xxxxxxxx)" },
        400,
      );
    }

    const supabase = adminClient();

    const reusable = await findInitializedBookingTxn(supabase, bookingId, chargeType);
    if (reusable?.metadata?.chapa_reference) {
      return jsonResponse({
        ok: true,
        tx_ref: reusable.txRef,
        reference: reusable.metadata.chapa_reference,
        charge_type: chargeType,
        status: "pending",
        auth_required: true,
        reused: true,
      });
    }

    const prepared = await prepareBookingChapaPayment(supabase, user.id, bookingId, {
      mobileOverride: mobile,
    });

    const chargeResult = await chapaDirectCharge(chargeType, {
      amount: formatChapaAmount(prepared.amount),
      currency: "ETB",
      email: prepared.email,
      first_name: prepared.firstName,
      last_name: prepared.lastName,
      tx_ref: prepared.txRef,
      mobile,
      subaccounts: {
        id: prepared.chapaSubaccountId,
        split_type: "percentage",
        split_value: prepared.split.commission_rate,
      },
    });

    await insertBookingPaymentTransaction(supabase, prepared, {
      charge_type: chargeType,
      chapa_reference: chargeResult.reference,
      mobile,
      payment_flow: "direct_charge",
    });

    return jsonResponse({
      ok: true,
      tx_ref: prepared.txRef,
      reference: chargeResult.reference,
      charge_type: chargeType,
      status: chargeResult.status,
      auth_required: chargeResult.auth_required,
      amount_etb: prepared.amount,
    });
  } catch (error) {
    if (error instanceof BookingPaymentError) {
      return jsonResponse(
        { error: error.message, code: error.code },
        error.status,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-charge:", message);
    return jsonResponse({ error: message }, 500);
  }
});
