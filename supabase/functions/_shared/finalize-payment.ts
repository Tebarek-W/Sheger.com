import { chapaMode, chapaVerify } from "./chapa.ts";
import { adminClient } from "./supabase.ts";

export async function finalizeVerifiedPayment(txRef: string) {
  const supabase = adminClient();
  const verified = await chapaVerify(txRef);

  if (verified.status !== "success") {
    return { ok: false as const, status: verified.status };
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

  if (txnError) throw txnError;
  if (!txn) throw new Error("Payment transaction not found");

  if (Number(txn.amount_etb) !== Number(verified.amount)) {
    throw new Error("Verified amount does not match expected amount");
  }
  if (verified.currency !== "ETB") {
    throw new Error("Unexpected currency");
  }

  const { data: finalizeResult, error: finalizeError } = await supabase.rpc(
    "finalize_chapa_payment",
    {
      p_tx_ref: txRef,
      p_chapa_reference: verified.reference ?? null,
      p_amount: verified.amount,
      p_payment_method: verified.payment_method ?? null,
      p_chapa_mode: verified.mode ?? expectedMode,
    },
  );

  if (finalizeError) throw finalizeError;

  return {
    ok: true as const,
    booking_id: txn.booking_id,
    payment_status: "paid",
    already_finalized: Boolean(
      finalizeResult && typeof finalizeResult === "object" &&
        "already_finalized" in finalizeResult &&
        finalizeResult.already_finalized,
    ),
  };
}
