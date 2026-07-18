import type { QueryClient } from "@tanstack/react-query";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (userId: string) => [...notificationKeys.all, userId] as const,
  unread: (userId: string) => ["notifications-unread", userId] as const,
};

export function clearNotificationQueries(queryClient: QueryClient): void {
  queryClient.removeQueries({ queryKey: notificationKeys.all });
  queryClient.removeQueries({ queryKey: ["notifications-unread"] });
}
