import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DualDateTime } from "@/components/ui/DualDateTime";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import {
  completeOwnerBooking,
  fetchMyBookings,
  updateOwnerBookingStatus,
  type OwnerBooking,
} from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";
import {
  formatBookingPrice,
  requiresBookingFinalization,
} from "@/lib/services/pricing";
import { parseOptionalNumber } from "@/lib/services/validation";
import type { BookingStatus } from "@/lib/types/database";

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: colors.primaryDarker,
  confirmed: colors.primary,
  cancelled: colors.textMuted,
  completed: colors.primaryDark,
};

function isPassedPendingBooking(booking: { status: BookingStatus; scheduled_at: string }) {
  return booking.status === "pending" && new Date(booking.scheduled_at).getTime() < Date.now();
}

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
  const [completingBooking, setCompletingBooking] = useState<OwnerBooking | null>(null);
  const [finalPrice, setFinalPrice] = useState("");
  const [actualDuration, setActualDuration] = useState("");

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

  const completeMutation = useMutation({
    mutationFn: ({
      id,
      finalPrice: price,
      actualDurationMinutes,
    }: {
      id: string;
      finalPrice?: number | null;
      actualDurationMinutes?: number | null;
    }) =>
      completeOwnerBooking(id, {
        finalPrice: price,
        actualDurationMinutes,
      }),
    onSuccess: () => {
      setCompletingBooking(null);
      setFinalPrice("");
      setActualDuration("");
      queryClient.invalidateQueries({ queryKey: ["owner-bookings", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["owner-stats", business?.id] });
    },
    onError: (e) => Alert.alert("Error", getErrorMessage(e)),
  });

  const act = (id: string, status: BookingStatus) => {
    mutation.mutate({ id, status });
  };

  const openComplete = (booking: OwnerBooking) => {
    if (requiresBookingFinalization(booking)) {
      setCompletingBooking(booking);
      setFinalPrice("");
      setActualDuration(
        booking.duration_model === "flexible" || booking.duration_model === "estimated"
          ? String(booking.duration_minutes)
          : "",
      );
      return;
    }
    act(booking.id, "completed");
  };

  const submitComplete = () => {
    if (!completingBooking) return;
    const parsedPrice = parseOptionalNumber(finalPrice);
    if (
      (completingBooking.pricing_model === "variable" ||
        completingBooking.pricing_model === "range") &&
      (parsedPrice == null || parsedPrice < 0)
    ) {
      Alert.alert("Final price required", "Enter the final amount charged for this visit.");
      return;
    }

    completeMutation.mutate({
      id: completingBooking.id,
      finalPrice: parsedPrice,
      actualDurationMinutes: parseOptionalNumber(actualDuration),
    });
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
        {bookings?.map((booking) => {
          const isPassed = isPassedPendingBooking(booking);
          const statusLabel = isPassed ? "Passed" : booking.status;
          const statusColor = isPassed ? colors.textMuted : STATUS_COLORS[booking.status];

          return (
            <View key={booking.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.customerBlock}>
                  <Text style={styles.customer}>{customerDisplayName(booking)}</Text>
                  {booking.profiles?.phone?.trim() && booking.profiles?.full_name?.trim() ? (
                    <Text style={styles.customerPhone}>{booking.profiles.phone}</Text>
                  ) : null}
                </View>
                <Text style={[styles.status, { color: statusColor }]}>
                  {statusLabel}
                </Text>
              </View>
              <Text style={styles.service}>
                {booking.services?.name ?? "Service"} · {formatBookingPrice(booking)}
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
                      onPress={() => openComplete(booking)}
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
          );
        })}
        {!bookings?.length && !isLoading ? (
          <Text style={styles.muted}>No bookings yet.</Text>
        ) : null}
      </View>

      <Modal
        visible={Boolean(completingBooking)}
        transparent
        animationType="fade"
        onRequestClose={() => setCompletingBooking(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Complete visit</Text>
            <Text style={styles.modalText}>
              Record the final amount and actual duration for this appointment.
            </Text>
            <Input
              label="Final price (ETB)"
              value={finalPrice}
              onChangeText={setFinalPrice}
              keyboardType="numeric"
            />
            <Input
              label="Actual duration (min, optional)"
              value={actualDuration}
              onChangeText={setActualDuration}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setCompletingBooking(null)}
              />
              <Button
                title="Complete"
                onPress={submitComplete}
                loading={completeMutation.isPending}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 20,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryDarker },
  modalText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
