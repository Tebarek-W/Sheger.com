export type NotificationType =
  | "booking_confirmed"
  | "booking_cancelled"
  | "booking_new"
  | "booking_reminder_24h"
  | "booking_reminder_1h";

export type PushPlatform = "ios" | "android";

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: PushPlatform;
  updated_at: string;
}
