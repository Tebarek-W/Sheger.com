import { chapaListBanks } from "../_shared/chapa.ts";
import { handleCors, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Supabase client invoke() uses POST; also allow GET for manual/cron checks.
  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const banks = await chapaListBanks();
    return jsonResponse({ banks });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("chapa-banks:", message);
    return jsonResponse({ error: message }, 500);
  }
});
