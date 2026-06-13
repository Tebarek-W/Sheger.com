import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { DualDateTime } from "@/components/ui/DualDateTime";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchMyBookings, updateOwnerBookingStatus, type OwnerBooking } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";
import type { BookingStatus } from "@/lib/types/database";

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: colors.primaryDarker,
  confirmed: colors.primary,
  cancelled: colors.textMuted,
  completed: colors.primaryDark,
};

function customerDisplayName(booking: OwnerBooking) {
  const name = booking.profiles?.full_name?.trim();
  if (name) return name;
  const phone = booking.profiles?.phone?.trim();
  if (phone) return phone;
  return "Sheger customer";
}

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
              <View style={styles.customerBlock}>
                <Text style={styles.customer}>{customerDisplayName(booking)}</Text>
                {booking.profiles?.phone?.trim() && booking.profiles?.full_name?.trim() ? (
                  <Text style={styles.customerPhone}>{booking.profiles.phone}</Text>
                ) : null}
              </View>
              <Text style={[styles.status, { color: STATUS_COLORS[booking.status] }]}>
                {booking.status}
              </Text>
            </View>
            <Text style={styles.service}>
              {booking.services?.name ?? "Service"} ·{" "}
              {Number(booking.services?.price ?? 0).toFixed(0)} ETB
            </Text>
            <DualDateTime iso={booking.scheduled_at} compact />

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
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  customerBlock: { flex: 1, gap: 2 },
  customer: { fontSize: 17, fontWeight: "700", color: colors.primaryDarker },
  customerPhone: { fontSize: 12, color: colors.textSecondary },
  status: { fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  service: { fontSize: 14, color: colors.primary, fontWeight: "600" },
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
