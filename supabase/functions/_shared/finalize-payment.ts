import { chapaMode, chapaVerify, isChapaSuccessfulStatus } from "./chapa.ts";
import { adminClient, formatEdgeError } from "./supabase.ts";

/** Chapa verify amount vs stored service price (fees may be passed to the customer). */
function paymentAmountsMatch(expected: number, verified: number): boolean {
  const bookingAmount = Number(expected);
  const chapaAmount = Number(verified);

  if (!Number.isFinite(bookingAmount) || !Number.isFinite(chapaAmount)) {
    return false;
  }

  if (Math.abs(bookingAmount - chapaAmount) < 0.01) {
    return true;
  }

  const diff = chapaAmount - bookingAmount;
  // Customer may pay a processing fee on top of the service price.
  const maxOverpay = Math.max(5, Math.ceil(bookingAmount * 0.10 * 100) / 100);
  if (diff > 0 && diff <= maxOverpay) {
    return true;
  }

  // Chapa may report merchant subtotal slightly below the initialized amount.
  if (diff < 0 && bookingAmount - chapaAmount <= 5) {
    return true;
  }

  return false;
}

export async function finalizeVerifiedPayment(txRef: string) {
  const supabase = adminClient();
  const verified = await chapaVerify(txRef);

  if (!isChapaSuccessfulStatus(verified.status)) {
    return {
      ok: false as const,
      status: verified.status,
      chapa_reference: verified.reference ?? null,
      chapa_payment_method: verified.payment_method ?? null,
    };
  }

  const expectedMode = chapaMode();
  if (verified.mode && verified.mode !== expectedMode) {
    throw new Error(`Unexpected Chapa mode: ${verified.mode}`);
  }

  const { data: txn, error: txnError } = await supabase
    .from("payment_transactions")
    .select("id, booking_id, amount_etb, status")
    .eq("tx_ref", txRef)
    .single();

  if (txnError) {
    throw new Error(formatEdgeError(txnError, "Payment transaction lookup failed"));
  }
  if (!txn) throw new Error("Payment transaction not found");

  const finalizeAmount = Number(txn.amount_etb);
  if (!paymentAmountsMatch(finalizeAmount, Number(verified.amount))) {
    throw new Error(
      `Verified amount (${verified.amount} ETB) does not match booking amount (${finalizeAmount} ETB).`,
    );
  }
  if (verified.currency !== "ETB") {
    throw new Error("Unexpected currency");
  }

  const { data: finalizeResult, error: finalizeError } = await supabase.rpc(
    "finalize_chapa_payment",
    {
      p_tx_ref: txRef,
      p_chapa_reference: verified.reference ?? null,
      p_amount: finalizeAmount,
      p_payment_method: verified.payment_method ?? null,
      p_chapa_mode: verified.mode ?? expectedMode,
    },
  );

  if (finalizeError) {
    throw new Error(formatEdgeError(finalizeError, "Could not finalize payment"));
  }

  const finalizeRecord =
    finalizeResult && typeof finalizeResult === "object"
      ? (finalizeResult as Record<string, unknown>)
      : null;

  if (
    finalizeRecord &&
    finalizeRecord.ok === false &&
    finalizeRecord.code === "slot_unavailable"
  ) {
    return {
      ok: false as const,
      code: "slot_unavailable" as const,
      payment_status: "paid_unfulfilled",
      chapa_status: verified.status,
      chapa_reference: verified.reference ?? null,
      chapa_payment_method: verified.payment_method ?? null,
    };
  }

  // Deferred bookings are created inside finalize_chapa_payment, so the booking
  // id comes back on the RPC result rather than on the transaction row.
  const bookingId =
    (typeof finalizeRecord?.booking_id === "string" && finalizeRecord.booking_id) ||
    txn.booking_id ||
    null;

  return {
    ok: true as const,
    booking_id: bookingId,
    payment_status: "paid",
    chapa_status: verified.status,
    chapa_reference: verified.reference ?? null,
    chapa_payment_method: verified.payment_method ?? null,
    already_finalized: Boolean(
      finalizeResult && typeof finalizeResult === "object" &&
        "already_finalized" in finalizeResult &&
        finalizeResult.already_finalized,
    ),
  };
}
