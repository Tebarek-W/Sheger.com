import {
  adminClient,
  formatEdgeError,
  handleCors,
  jsonResponse,
  requireUser,
} from "../_shared/supabase.ts";

/**
 * Permanently deletes the authenticated user's auth account.
 * Cascades remove profile and related rows (bookings, businesses owned, etc.).
 * Required for Apple App Store Guideline 5.1.1(v).
 */
Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const { user } = await requireUser(req);
    const supabase = adminClient();

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      return jsonResponse({ error: formatEdgeError(profileError) }, 500);
    }

    if (profile?.role === "admin") {
      return jsonResponse(
        { error: "Admin accounts cannot be deleted from the app." },
        403,
      );
    }

    // Cancel upcoming customer bookings before cascade delete (cleaner for businesses).
    await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("customer_id", user.id)
      .in("status", ["pending", "confirmed"])
      .gte("scheduled_at", new Date().toISOString());

    // Soft-hide businesses owned by this user so marketplace does not show orphans
    // during cascade; deleteUser still cascades businesses via owner_id.
    await supabase
      .from("businesses")
      .update({ status: "suspended" })
      .eq("owner_id", user.id);

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return jsonResponse({ error: formatEdgeError(deleteError, "Could not delete account") }, 500);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    const message = formatEdgeError(error, "Could not delete account");
    const status = message === "Unauthorized" || message.includes("authorization") ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
