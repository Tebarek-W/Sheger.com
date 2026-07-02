import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Header } from "@/components/ui/Header";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationRouteForType,
} from "@/lib/notifications/api";
import { notificationKeys } from "@/lib/notifications/query-keys";
import type { AppNotification } from "@/lib/types/notifications";

type NotificationInboxProps = {
  title?: string;
  showBack?: boolean;
};

export function NotificationInbox({
  title = "Notifications",
  showBack = true,
}: NotificationInboxProps) {
  const { profile, session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const { data: notifications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: notificationKeys.list(userId ?? ""),
    queryFn: () => fetchNotifications(),
    enabled: Boolean(userId),
    refetchInterval: 30_000,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread(userId) });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: notificationKeys.list(userId) });
      queryClient.invalidateQueries({ queryKey: notificationKeys.unread(userId) });
    },
  });

  const onPressItem = (item: AppNotification) => {
    if (!item.read_at) {
      markReadMutation.mutate(item.id);
    }
    const route = notificationRouteForType(item.type, profile?.role);
    router.push(route);
  };

  const unreadCount = notifications?.filter((n) => !n.read_at).length ?? 0;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={notifications ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />}
        ListHeaderComponent={
          <>
            <Header title={title} subtitle="Booking updates and reminders" showBack={showBack} />
            {unreadCount > 0 ? (
              <Pressable
                style={styles.markAll}
                onPress={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
              >
                <Text style={styles.markAllText}>Mark all as read</Text>
              </Pressable>
            ) : null}
            {isLoading || !userId ? <Text style={styles.muted}>Loading notifications…</Text> : null}
          </>
        }
        ListEmptyComponent={
          !isLoading && userId ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                You will see booking confirmations, reminders, and cancellations here.
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.item, !item.read_at && styles.itemUnread]}
            onPress={() => onPressItem(item)}
          >
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {!item.read_at ? <View style={styles.dot} /> : null}
            </View>
            <Text style={styles.itemBody}>{item.body}</Text>
            <Text style={styles.itemTime}>{new Date(item.created_at).toLocaleString()}</Text>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, padding: ownerLayout.screenPadding },
  markAll: { alignSelf: "flex-end", marginBottom: ownerLayout.cardGap },
  markAllText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  muted: { color: colors.textMuted, fontSize: 14 },
  empty: {
    marginTop: ownerLayout.sectionGap,
    padding: ownerLayout.screenPadding,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: ownerLayout.blockGap / 2,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryDarker },
  emptyText: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  item: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: ownerLayout.cardPadding,
    gap: 6,
  },
  itemUnread: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  itemHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  itemTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryDarker, flex: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  itemBody: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  itemTime: { fontSize: 12, color: colors.textMuted },
  separator: { height: ownerLayout.listGap },
});
