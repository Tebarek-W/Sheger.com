import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_new"
  | "booking_reminder_24h"
  | "booking_reminder_1h";

export type NotificationPayload = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

function formatAddisDateTime(iso: string): string {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Addis_Ababa",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return iso;
  }
}

export function formatScheduledAt(iso: string | null | undefined): string {
  if (!iso) return "your scheduled time";
  return formatAddisDateTime(iso);
}

export async function deliverNotification(
  supabase: SupabaseClient,
  payload: NotificationPayload,
): Promise<void> {
  const { data: row, error } = await supabase
    .from("notifications")
    .insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to insert notification", error);
    throw error;
  }

  const { data: tokens } = await supabase
    .from("push_tokens")
    .select("expo_push_token")
    .eq("user_id", payload.userId);

  const pushTokens = (tokens ?? []).map((t) => t.expo_push_token).filter(Boolean);
  if (!pushTokens.length) return;

  const messages = pushTokens.map((token) => ({
    to: token,
    sound: "default",
    title: payload.title,
    body: payload.body,
    data: {
      notificationId: row.id,
      type: payload.type,
      ...(payload.data ?? {}),
    },
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

  if (!response.ok) {
    const text = await response.text();
    console.error("Expo push failed", response.status, text);
  }
}
