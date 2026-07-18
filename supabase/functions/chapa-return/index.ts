import {
  appDeepLinkReturnUrl,
  buildChapaReceiptUrl,
} from "../_shared/chapa.ts";
import { finalizeVerifiedPayment } from "../_shared/finalize-payment.ts";
import { handleCors } from "../_shared/supabase.ts";

/**
 * Chapa return_url handler — no HTML page (avoids in-app browser showing raw source).
 * Verifies payment server-side, then redirects into the Sheger app.
 *
 * @see https://developer.chapa.co/integrations/accept-payments
 * @see https://developer.chapa.co/integrations/chapa-receipt
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  const requestUrl = new URL(req.url);
  const txRef =
    requestUrl.searchParams.get("tx_ref")?.trim() ??
    requestUrl.searchParams.get("trx_ref")?.trim() ??
    "";

  let chapaReference: string | null = null;

  if (txRef) {
    try {
      const result = await finalizeVerifiedPayment(txRef);
      if (result.ok && result.chapa_reference) {
        chapaReference = result.chapa_reference;
      }
    } catch (error) {
      console.error("chapa-return verify:", txRef, error);
    }
  }

  const appUrl = appDeepLinkReturnUrl(txRef, chapaReference);

  if (req.method === "HEAD") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: appUrl,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  // Prefer HTTP redirect — never render an HTML bridge page in the payment browser.
  const receiptUrl = chapaReference ? buildChapaReceiptUrl(chapaReference) : null;

  return new Response(null, {
    status: 302,
    headers: {
      Location: appUrl,
      "Cache-Control": "no-store, no-cache, must-revalidate",
      ...(receiptUrl ? { "X-Chapa-Receipt-Url": receiptUrl } : {}),
    },
  });
});
