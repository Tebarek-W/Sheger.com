import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = adminClient();

    const { data: settings, error: settingsError } = await supabase
      .from("platform_settings")
      .select("grace_period_days")
      .eq("id", 1)
      .single();

    if (settingsError) throw settingsError;

    const graceDays = settings?.grace_period_days ?? 3;
    const now = new Date().toISOString();

    const { data: expired, error: fetchError } = await supabase
      .from("business_subscriptions")
      .select("id, business_id, current_period_end")
      .eq("status", "active")
      .lt("current_period_end", now);

    if (fetchError) throw fetchError;

    let updated = 0;

    for (const row of expired ?? []) {
      const graceEnds = new Date(row.current_period_end);
      graceEnds.setDate(graceEnds.getDate() + graceDays);

      const { error } = await supabase
        .from("business_subscriptions")
        .update({
          status: "past_due",
          grace_ends_at: graceEnds.toISOString(),
          updated_at: now,
        })
        .eq("id", row.id)
        .eq("status", "active");

      if (error) throw error;
      updated += 1;
    }

    return jsonResponse({ ok: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return jsonResponse({ error: message }, 500);
  }
});
