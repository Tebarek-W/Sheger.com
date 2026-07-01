import { finalizeVerifiedPayment } from "../_shared/finalize-payment.ts";
import { handleCors } from "../_shared/supabase.ts";

/**
 * Chapa callback_url handler.
 * @see https://developer.chapa.co/integrations/accept-payments
 * @see https://developer.chapa.co/integrations/verify-payments
 *
 * After payment, Chapa calls this URL with the transaction reference (and
 * sometimes a status). Chapa may use GET (query params) or POST (JSON body)
 * depending on integration, so we accept both. We always re-verify via the
 * Chapa API before finalizing (best practice).
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method === "HEAD") {
    return new Response(null, { status: 200 });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  let txRef =
    url.searchParams.get("trx_ref")?.trim() ??
    url.searchParams.get("tx_ref")?.trim() ??
    "";
  let status = url.searchParams.get("status")?.trim().toLowerCase() ?? "";

  if (!txRef && req.method === "POST") {
    try {
      const body = (await req.json()) as {
        trx_ref?: string;
        tx_ref?: string;
        status?: string;
      };
      txRef = body.trx_ref?.trim() ?? body.tx_ref?.trim() ?? "";
      status = body.status?.trim().toLowerCase() ?? status;
    } catch {
      // Body was not JSON — fall through to the no-txRef guard below.
    }
  }

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
