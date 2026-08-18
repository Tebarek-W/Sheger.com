import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";
import { requireInternalSecret } from "../_shared/internal-auth.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const unauthorized = requireInternalSecret(req);
  if (unauthorized) return unauthorized;

  try {
    const supabase = adminClient();
    const { data: updated, error } = await supabase.rpc("mark_subscriptions_past_due");
    if (error) throw error;

    return jsonResponse({ ok: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return jsonResponse({ error: message }, 500);
  }
});
