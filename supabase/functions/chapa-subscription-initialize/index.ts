import {
  chapaInitialize,
  formatChapaAmount,
  normalizeChapaPhone,
} from "../_shared/chapa.ts";
import {
  insertSubscriptionPaymentTransaction,
  isBillingInterval,
  prepareSubscriptionChapaPayment,
  SubscriptionPaymentError,
} from "../_shared/chapa-subscription-payment.ts";
import {
  adminClient,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

type InitializeBody = {
  businessId?: string;
  planId?: string;
  billingInterval?: string;
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
    const businessId = body.businessId?.trim();
    const planId = body.planId?.trim();
    const billingInterval = body.billingInterval?.trim();

    if (!businessId || !planId) {
      return jsonResponse({ error: "businessId and planId are required" }, 400);
    }
    if (!isBillingInterval(billingInterval)) {
      return jsonResponse({ error: "billingInterval must be 'monthly' or 'yearly'" }, 400);
    }

    const supabase = adminClient();

    const prepared = await prepareSubscriptionChapaPayment(
      supabase,
      user.id,
      businessId,
      planId,
      billingInterval,
    );

    // Subscription fee is 100% to Sheger — no subaccount split.
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
        description: `${prepared.planName} subscription (${prepared.billingInterval})`,
      },
      meta: {
        business_id: prepared.businessId,
        owner_id: prepared.ownerId,
        plan_id: prepared.planId,
        billing_interval: prepared.billingInterval,
        purpose: "subscription",
        payment_reason: `Sheger subscription — ${prepared.planName}`,
      },
    });

    await insertSubscriptionPaymentTransaction(supabase, prepared, {
      checkout_url: initResult.checkout_url,
      payment_flow: "hosted_checkout",
      plan_name: prepared.planName,
    });

    return jsonResponse({
      checkout_url: initResult.checkout_url,
      tx_ref: prepared.txRef,
      return_url: prepared.returnUrl,
    });
  } catch (error) {
    if (error instanceof SubscriptionPaymentError) {
      return jsonResponse(
        { error: error.message, code: error.code },
        error.status,
      );
    }

    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-subscription-initialize:", message);
    return jsonResponse({ error: message }, 500);
  }
});
