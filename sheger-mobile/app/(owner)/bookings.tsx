import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchMyBookings, updateOwnerBookingStatus } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";
import type { BookingStatus } from "@/lib/types/database";

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: colors.primaryDarker,
  confirmed: colors.primary,
  cancelled: colors.textMuted,
  completed: colors.primaryDark,
};

export default function OwnerBookingsScreen() {
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();

  const { data: bookings, isLoading, refetch } = useQuery({
    queryKey: ["owner-bookings", business?.id],
    queryFn: () => fetchMyBookings(business!.id),
    enabled: Boolean(business?.id),
    refetchInterval: 15_000,
  });

  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BookingStatus }) =>
      updateOwnerBookingStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-bookings", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["owner-stats", business?.id] });
    },
    onError: (e) => Alert.alert("Error", getErrorMessage(e)),
  });

  const act = (id: string, status: BookingStatus) => {
    mutation.mutate({ id, status });
  };

  return (
    <Screen scroll>
      <Header
        title="Bookings"
        subtitle="Manage incoming appointments"
        showBack
      />

      <Pressable onPress={() => refetch()} style={styles.refresh}>
        <Text style={styles.refreshText}>↻ Refresh availability</Text>
      </Pressable>

      {isLoading ? <Text style={styles.muted}>Loading bookings...</Text> : null}

      <View style={styles.list}>
        {bookings?.map((booking) => (
          <View key={booking.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.customer}>
                {booking.profiles?.full_name ?? "Customer"}
              </Text>
              <Text style={[styles.status, { color: STATUS_COLORS[booking.status] }]}>
                {booking.status}
              </Text>
            </View>
            <Text style={styles.service}>
              {booking.services?.name ?? "Service"} ·{" "}
              {Number(booking.services?.price ?? 0).toFixed(0)} ETB
            </Text>
            <Text style={styles.when}>
              {new Date(booking.scheduled_at).toLocaleString()}
            </Text>

            <View style={styles.actions}>
              {booking.status === "pending" ? (
                <>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => act(booking.id, "confirmed")}
                  >
                    <Text style={styles.actionPrimary}>Confirm</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtnOutline}
                    onPress={() => act(booking.id, "cancelled")}
                  >
                    <Text style={styles.actionOutline}>Cancel</Text>
                  </Pressable>
                </>
              ) : null}
              {booking.status === "confirmed" ? (
                <>
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => act(booking.id, "completed")}
                  >
                    <Text style={styles.actionPrimary}>Complete</Text>
                  </Pressable>
                  <Pressable
                    style={styles.actionBtnOutline}
                    onPress={() => act(booking.id, "cancelled")}
                  >
                    <Text style={styles.actionOutline}>Cancel</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        ))}
        {!bookings?.length && !isLoading ? (
          <Text style={styles.muted}>No bookings yet.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  refresh: { marginBottom: 16 },
  refreshText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  list: { gap: 12, paddingBottom: 24 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  customer: { fontSize: 17, fontWeight: "700", color: colors.primaryDarker },
  status: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  service: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  when: { fontSize: 13, color: colors.textMuted },
  actions: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionPrimary: { color: colors.white, fontWeight: "700", fontSize: 14 },
  actionBtnOutline: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionOutline: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  muted: { color: colors.textMuted },
});
