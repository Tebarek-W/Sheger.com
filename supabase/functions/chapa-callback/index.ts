import { finalizeVerifiedPayment } from "../_shared/finalize-payment.ts";
import { handleCors } from "../_shared/supabase.ts";

/**
 * Chapa callback_url handler (GET).
 * @see https://developer.chapa.co/integrations/accept-payments
 * @see https://developer.chapa.co/integrations/verify-payments
 *
 * After payment, Chapa calls this URL with trx_ref, ref_id, and status.
 * We always re-verify via the Chapa API before finalizing (best practice).
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (req.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  const url = new URL(req.url);
  const txRef =
    url.searchParams.get("trx_ref")?.trim() ??
    url.searchParams.get("tx_ref")?.trim() ??
    "";
  const status = url.searchParams.get("status")?.trim().toLowerCase() ?? "";

  if (!txRef) {
    return new Response("OK", { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  if (status && status !== "success") {
    return new Response("OK", { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  try {
    await finalizeVerifiedPayment(txRef);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-callback:", txRef, message);
  }

  return new Response("OK", { status: 200, headers: { "Cache-Control": "no-store" } });
});
