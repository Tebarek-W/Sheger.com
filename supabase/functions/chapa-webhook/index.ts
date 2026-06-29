import { isValidChapaWebhookSignature } from "../_shared/chapa.ts";
import { finalizeVerifiedPayment } from "../_shared/finalize-payment.ts";
import { handleCors, jsonResponse } from "../_shared/supabase.ts";

type WebhookPayload = {
  event?: string;
  status?: string;
  tx_ref?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const payload = (await req.json()) as WebhookPayload;
    const valid = await isValidChapaWebhookSignature(payload, req);

    if (!valid) {
      console.warn("chapa-webhook: invalid signature");
      return jsonResponse({ error: "Invalid signature" }, 401);
    }

    const txRef = payload.tx_ref?.trim();
    if (!txRef) {
      return jsonResponse({ ok: true, skipped: true, reason: "no tx_ref" });
    }

    const isSuccess =
      payload.event === "charge.success" ||
      payload.status === "success";

    if (!isSuccess) {
      return jsonResponse({ ok: true, skipped: true, event: payload.event ?? payload.status });
    }

    const result = await finalizeVerifiedPayment(txRef);
    return jsonResponse({ ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-webhook:", message);
    return jsonResponse({ error: message }, 500);
  }
});
