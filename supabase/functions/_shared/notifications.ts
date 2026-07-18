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

  const { error: queueError } = await supabase.rpc("enqueue_notification_deliveries", {
    p_notification_id: row.id,
    p_user_id: payload.userId,
    p_title: payload.title,
    p_body: payload.body,
    p_data: {
      notificationId: row.id,
      type: payload.type,
      ...(payload.data ?? {}),
    },
  });

  if (queueError) {
    console.error("Failed to queue push deliveries", queueError);
    throw queueError;
  }
}
