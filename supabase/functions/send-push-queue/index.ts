import { adminClient, handleCors, jsonResponse } from "../_shared/supabase.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

type DeliveryRow = {
  id: string;
  notification_id: string;
  user_id: string;
  expo_push_token: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  attempts: number;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = adminClient();
    const { data: deliveries, error } = await supabase.rpc("claim_notification_deliveries", {
      p_limit: 100,
    });

    if (error) throw error;

    const rows = (deliveries ?? []) as DeliveryRow[];
    if (!rows.length) {
      return jsonResponse({ ok: true, claimed: 0, sent: 0, failed: 0 });
    }

    const messages = rows.map((row) => ({
      to: row.expo_push_token,
      sound: "default",
      title: row.title,
      body: row.body,
      data: row.data,
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const payload = await response.json().catch(() => null);
    const tickets: { status?: string; message?: string; details?: Record<string, unknown> }[] =
      Array.isArray(payload?.data) ? payload.data : [];

    let sent = 0;
    let failed = 0;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const ticket = tickets[index];
      const isError = !response.ok || ticket?.status === "error";
      const nextStatus = isError ? (row.attempts >= 3 ? "failed" : "pending") : "sent";
      const nextError = isError
        ? ticket?.message ?? `Expo push request failed with status ${response.status}`
        : null;

      const { error: finishError } = await supabase.rpc("finish_notification_delivery", {
        p_delivery_id: row.id,
        p_status: nextStatus,
        p_error: nextError,
      });

      if (finishError) throw finishError;
      if (nextStatus === "sent") sent += 1;
      else failed += 1;
    }

    return jsonResponse({ ok: true, claimed: rows.length, sent, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return jsonResponse({ error: message }, 500);
  }
});
