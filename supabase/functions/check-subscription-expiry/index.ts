import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

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
