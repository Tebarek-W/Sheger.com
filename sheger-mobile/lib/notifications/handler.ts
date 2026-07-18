import { router } from "expo-router";

import { notificationRouteForType } from "@/lib/notifications/api";
import { isPushNotificationsSupported } from "@/lib/notifications/push-support";
import type { NotificationType } from "@/lib/types/notifications";
import type { UserRole } from "@/lib/types/database";

export async function setupNotificationHandlers(
  role: UserRole | null | undefined,
): Promise<() => void> {
  if (!isPushNotificationsSupported()) {
    return () => {};
  }

  const Notifications = await import("expo-notifications");

  const navigateFromNotification = (
    response: Awaited<ReturnType<typeof Notifications.getLastNotificationResponseAsync>>,
  ) => {
    if (!response) return;
    const data = response.notification.request.content.data as {
      type?: NotificationType;
      booking_id?: string;
    };

    const route = notificationRouteForType(data.type ?? "booking_confirmed", role);
    router.push(route);
  };

  const subscription = Notifications.addNotificationResponseReceivedListener(navigateFromNotification);

  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) navigateFromNotification(response);
  });

  return () => subscription.remove();
}
