import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = adminClient();
    const { data, error } = await supabase.rpc("expire_unpaid_bookings");

    if (error) throw error;

    return jsonResponse({ ok: true, expired: data ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("expire-unpaid-bookings:", message);
    return jsonResponse({ error: message }, 500);
  }
});
