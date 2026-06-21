import { useQuery } from "@tanstack/react-query";

import { getUnreadNotificationCount } from "@/lib/notifications/api";
import { notificationKeys } from "@/lib/notifications/query-keys";

export function useUnreadNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: notificationKeys.unread(userId ?? ""),
    queryFn: getUnreadNotificationCount,
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });
}
