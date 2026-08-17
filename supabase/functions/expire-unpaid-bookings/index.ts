import { chapaCancel } from "../_shared/chapa.ts";
import { requireInternalSecret } from "../_shared/internal-auth.ts";
import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";

/**
 * Expire unpaid Chapa checkouts after the 15-minute hold.
 * Cancels active transactions on Chapa first (expires checkout links).
 * @see https://developer.chapa.co/integrations/transaction-cancel
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

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

    const { data: holdsExpired, error: holdsError } = await supabase.rpc(
      "expire_booking_slot_holds",
    );
    if (holdsError) {
      console.warn("expire-unpaid-bookings holds:", holdsError);
    }

    // Deferred bookings never created a row, so they don't appear above. Their
    // abandoned checkout transactions still hold live Chapa links — expire them.
    // Slot holds last 15 minutes, matching this draft checkout cutoff.
    const draftCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    let draftsCancelled = 0;

    const { data: staleDrafts } = await supabase
      .from("payment_transactions")
      .select("id, tx_ref")
      .in("purpose", ["booking", "subscription"])
      .eq("status", "initialized")
      .or("booking_id.is.null,purpose.eq.subscription")
      .lt("created_at", draftCutoff);

    for (const draft of staleDrafts ?? []) {
      if (!draft.tx_ref) continue;
      try {
        const result = await chapaCancel(draft.tx_ref);
        if (result.cancelled || result.skipped) {
          draftsCancelled += 1;
        }
      } catch (cancelError) {
        console.warn("expire-unpaid-bookings draft:", draft.tx_ref, cancelError);
      }

      await supabase
        .from("payment_transactions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", draft.id);
    }

    return jsonResponse({
      ok: true,
      expired: data ?? 0,
      holds_expired: holdsExpired ?? 0,
      chapa_cancel_attempts: chapaCancelled,
      drafts_cancelled: draftsCancelled,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("expire-unpaid-bookings:", message);
    return jsonResponse({ error: message }, 500);
  }
});
