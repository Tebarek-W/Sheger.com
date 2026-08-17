import { supabase } from "@/lib/supabase";
import type { AppNotification, NotificationType } from "@/lib/types/notifications";

export async function fetchNotifications(limit = 50): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

export async function getUnreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);

  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) throw error;
}

export function notificationBookingId(data: Record<string, unknown> | null | undefined): string | null {
  const raw = data?.booking_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export function notificationRouteForType(
  _type: NotificationType,
  role: "customer" | "business_owner" | "admin" | null | undefined,
  bookingId?: string | null,
): string {
  const base = role === "business_owner" ? "/(owner)/bookings" : "/(app)/(tabs)/bookings";
  if (!bookingId) return base;
  return `${base}?bookingId=${encodeURIComponent(bookingId)}`;
}
