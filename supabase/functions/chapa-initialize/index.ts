import {
  BookingPaymentError,
  findInitializedBookingTxn,
  insertBookingPaymentTransaction,
  prepareBookingChapaPayment,
} from "../_shared/chapa-booking-payment.ts";
import {
  buildChapaReturnUrl,
  chapaInitialize,
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
    const body = (await req.json()) as InitializeBody;
    const bookingId = body.bookingId?.trim();

    if (!bookingId) {
      return jsonResponse({ error: "bookingId is required" }, 400);
    }

    const supabase = adminClient();
    const functionsBase = supabaseFunctionsBaseUrl();
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const reusable = await findInitializedBookingTxn(supabase, bookingId);
    if (reusable?.metadata?.checkout_url) {
      return jsonResponse({
        checkout_url: reusable.metadata.checkout_url,
        tx_ref: reusable.txRef,
        return_url: buildChapaReturnUrl(functionsBase, reusable.txRef, anonKey),
        reused: true,
      });
    }

    const prepared = await prepareBookingChapaPayment(supabase, user.id, bookingId);

    const initResult = await chapaInitialize({
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
        title: "Sheger",
        description: `${prepared.serviceLabel} at ${prepared.businessLabel}`,
      },
      meta: {
        booking_id: prepared.bookingId,
        customer_id: prepared.customerId,
        purpose: "booking",
        payment_reason: `Sheger booking — ${prepared.serviceLabel}`,
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
      subaccounts: {
        id: prepared.chapaSubaccountId,
        split_type: "percentage",
        split_value: prepared.split.commission_rate,
      },
    });

    await insertBookingPaymentTransaction(supabase, prepared, {
      checkout_url: initResult.checkout_url,
      payment_flow: "hosted_checkout",
    });

    return jsonResponse({
      checkout_url: initResult.checkout_url,
      tx_ref: prepared.txRef,
      return_url: prepared.returnUrl,
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
