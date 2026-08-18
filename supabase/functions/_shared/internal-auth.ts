import { jsonResponse } from "./supabase.ts";

/**
 * Shared secret for cron jobs and the bookings database webhook.
 * Set INTERNAL_FUNCTION_SECRET (or CRON_SECRET) in Edge Function secrets.
 * Callers send it as `x-internal-secret` or `Authorization: Bearer <secret>`.
 */
export function requireInternalSecret(req: Request): Response | null {
  const expected = (
    Deno.env.get("INTERNAL_FUNCTION_SECRET") ??
    Deno.env.get("CRON_SECRET") ??
    ""
  ).trim();

  if (!expected) {
    return jsonResponse(
      { error: "INTERNAL_FUNCTION_SECRET is not configured" },
      503,
    );
  }

  const headerSecret =
    req.headers.get("x-internal-secret")?.trim() ||
    req.headers.get("x-cron-secret")?.trim() ||
    "";
  const auth = req.headers.get("Authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : "";
  const provided = headerSecret || bearer;

  if (!provided || provided !== expected) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  return null;
}
