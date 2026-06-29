import {
  buildChapaReturnUrl,
  chapaInitialize,
  chapaMode,
  formatChapaAmount,
  sanitizeChapaText,
  splitFullName,
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

function makeTxRef(bookingId: string): string {
  const stamp = Date.now().toString(36);
  const shortId = bookingId.replace(/-/g, "").slice(0, 8);
  return `sheger-bkg-${shortId}-${stamp}`;
}

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

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, customer_id, business_id, service_id, payment_status, pricing_model, listed_price, status",
      )
      .eq("id", bookingId)
      .single();

    if (bookingError) throw bookingError;
    if (!booking) return jsonResponse({ error: "Booking not found" }, 404);
    if (booking.customer_id !== user.id) {
      return jsonResponse({ error: "Not authorized for this booking" }, 403);
    }
    if (booking.status !== "pending") {
      return jsonResponse({ error: "Booking is not payable" }, 400);
    }
    if (booking.payment_status === "paid") {
      return jsonResponse({ error: "Booking is already paid" }, 400);
    }
    if (booking.payment_status !== "awaiting_payment") {
      return jsonResponse({ error: "Booking does not require online payment" }, 400);
    }
    if (booking.pricing_model !== "fixed" || booking.listed_price == null) {
      return jsonResponse({ error: "Only fixed-price services can be paid online" }, 400);
    }

    const amount = Number(booking.listed_price);
    if (!Number.isFinite(amount) || amount <= 0) {
      return jsonResponse({ error: "Invalid booking amount" }, 400);
    }

    const functionsBase = supabaseFunctionsBaseUrl();

    const [{ data: profile }, { data: business }, { data: service }, { data: existingTxn }] =
      await Promise.all([
        supabase.from("profiles").select("full_name, phone").eq("id", user.id).single(),
        supabase.from("businesses").select("name").eq("id", booking.business_id).single(),
        supabase.from("services").select("name").eq("id", booking.service_id).single(),
        supabase
          .from("payment_transactions")
          .select("tx_ref, status, metadata")
          .eq("booking_id", bookingId)
          .eq("status", "initialized")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (existingTxn?.tx_ref) {
      const checkoutMeta = existingTxn.metadata as { checkout_url?: string } | null;
      if (checkoutMeta?.checkout_url) {
        return jsonResponse({
          checkout_url: checkoutMeta.checkout_url,
          tx_ref: existingTxn.tx_ref,
          return_url: buildChapaReturnUrl(functionsBase, existingTxn.tx_ref),
          reused: true,
        });
      }
    }

    const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
    const email = authUser.user?.email ?? `customer+${user.id.slice(0, 8)}@sheger.app`;
    const names = splitFullName(profile?.full_name);
    const txRef = makeTxRef(bookingId);
    const returnUrl = buildChapaReturnUrl(functionsBase, txRef);

    const initResult = await chapaInitialize({
      amount: formatChapaAmount(amount),
      currency: "ETB",
      email,
      first_name: sanitizeChapaText(names.first_name, "Sheger", 50),
      last_name: sanitizeChapaText(names.last_name, "Customer", 50),
      tx_ref: txRef,
      phone_number: profile?.phone ?? undefined,
      callback_url: `${functionsBase}/chapa-webhook`,
      return_url: returnUrl,
      customization: {
        title: "Sheger",
        description: sanitizeChapaText(
          `${service?.name ?? "Service"} at ${business?.name ?? "Business"}`,
          "Sheger booking payment",
        ),
      },
      meta: {
        booking_id: bookingId,
        customer_id: user.id,
        purpose: "booking",
      },
    });

    const { error: insertError } = await supabase.from("payment_transactions").insert({
      purpose: "booking",
      booking_id: bookingId,
      tx_ref: txRef,
      amount_etb: amount,
      currency: "ETB",
      status: "initialized",
      chapa_mode: chapaMode(),
      metadata: {
        checkout_url: initResult.checkout_url,
        customer_id: user.id,
      },
    });

    if (insertError) throw insertError;

    return jsonResponse({
      checkout_url: initResult.checkout_url,
      tx_ref: txRef,
      return_url: returnUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-initialize:", message);
    return jsonResponse({ error: message }, 500);
  }
});
