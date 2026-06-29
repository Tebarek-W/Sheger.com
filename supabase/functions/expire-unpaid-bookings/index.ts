import { chapaCancel } from "../_shared/chapa.ts";
import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";

/**
 * Expire unpaid Chapa checkouts after the 15-minute hold.
 * Cancels active transactions on Chapa first (expires checkout links).
 * @see https://developer.chapa.co/integrations/transaction-cancel
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = adminClient();
    const now = new Date().toISOString();

    const { data: expiredBookings, error: listError } = await supabase
      .from("bookings")
      .select("id")
      .eq("payment_status", "awaiting_payment")
      .eq("status", "pending")
      .not("payment_expires_at", "is", null)
      .lt("payment_expires_at", now);

    if (listError) throw listError;

    let chapaCancelled = 0;

    for (const booking of expiredBookings ?? []) {
      const { data: txn } = await supabase
        .from("payment_transactions")
        .select("tx_ref")
        .eq("booking_id", booking.id)
        .eq("status", "initialized")
        .maybeSingle();

      if (!txn?.tx_ref) continue;

      try {
        const result = await chapaCancel(txn.tx_ref);
        if (result.cancelled || result.skipped) {
          chapaCancelled += 1;
        }
      } catch (cancelError) {
        console.warn("expire-unpaid-bookings chapa:", txn.tx_ref, cancelError);
      }
    }

    const { data, error } = await supabase.rpc("expire_unpaid_bookings");

    if (error) throw error;

    return jsonResponse({
      ok: true,
      expired: data ?? 0,
      chapa_cancel_attempts: chapaCancelled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("expire-unpaid-bookings:", message);
    return jsonResponse({ error: message }, 500);
  }
});
