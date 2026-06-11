import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { fetchBookingsForDay, fetchWorkingHours } from "@/lib/api/bookings";
import { formatSlotDate, formatSlotLabel, generateTimeSlots } from "@/lib/booking/slots";
import { useBookingStore } from "@/stores/bookingStore";

export default function BookScreen() {
  return (
    <RequireAuth>
      <BookScreenContent />
    </RequireAuth>
  );
}

function BookScreenContent() {
  const business = useBookingStore((s) => s.business);
  const service = useBookingStore((s) => s.service);
  const setScheduledAt = useBookingStore((s) => s.setScheduledAt);
  const scheduledAt = useBookingStore((s) => s.scheduledAt);

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, []);

  const { data: workingHours, isLoading: hoursLoading } = useQuery({
    queryKey: ["working-hours", business?.id, selectedDate.getDay()],
    queryFn: () => fetchWorkingHours(business!.id, selectedDate.getDay()),
    enabled: Boolean(business?.id),
    refetchInterval: 30_000,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ["day-bookings", business?.id, selectedDate.toDateString()],
    queryFn: () => fetchBookingsForDay(business!.id, selectedDate),
    enabled: Boolean(business?.id),
    refetchInterval: 15_000,
  });

  const slots = useMemo(() => {
    if (!service) return [];
    return generateTimeSlots(
      workingHours ?? undefined,
      service.duration_minutes,
      bookings ?? [],
      selectedDate,
    );
  }, [workingHours, service, bookings, selectedDate]);

  if (!business || !service) {
    return (
      <Screen>
        <Header title="Booking" showBack />
        <Text style={styles.muted}>Select a service first.</Text>
      </Screen>
    );
  }

  const loading = hoursLoading || bookingsLoading;

  return (
    <Screen scroll>
      <Header
        title="Pick a time"
        subtitle={`${service.name} at ${business.name}`}
        showBack
      />

      <Text style={styles.section}>Date</Text>
      <View style={styles.dateRow}>
        {dates.map((date) => {
          const active = date.toDateString() === selectedDate.toDateString();
          return (
            <Pressable
              key={date.toISOString()}
              style={[styles.dateChip, active && styles.dateChipActive]}
              onPress={() => {
                setSelectedDate(date);
                setScheduledAt(null);
              }}
            >
              <Text style={[styles.dateChipText, active && styles.dateChipTextActive]}>
                {date.toLocaleDateString("en-ET", { weekday: "short", day: "numeric" })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.section}>Available slots</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : slots.length === 0 ? (
        <Text style={styles.muted}>No slots available for this day.</Text>
      ) : (
        <View style={styles.slots}>
          {slots.map((slot) => {
            const active = scheduledAt === slot;
            return (
              <Pressable
                key={slot}
                style={[styles.slot, active && styles.slotActive]}
                onPress={() => setScheduledAt(slot)}
              >
                <Text style={[styles.slotText, active && styles.slotTextActive]}>
                  {formatSlotLabel(slot)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {scheduledAt ? (
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Selected</Text>
          <Text style={styles.summaryValue}>
            {formatSlotDate(scheduledAt)} at {formatSlotLabel(scheduledAt)}
          </Text>
          <Button title="Continue to Payment" onPress={() => router.push("/(app)/payment")} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker, marginBottom: 10, marginTop: 8 },
  dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  dateChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dateChipText: { color: colors.primaryDarker, fontWeight: "600", fontSize: 13 },
  dateChipTextActive: { color: colors.white },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  slot: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  slotActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  slotText: { color: colors.primaryDarker, fontWeight: "600" },
  slotTextActive: { color: colors.white },
  summary: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  summaryLabel: { fontSize: 13, color: colors.textMuted, fontWeight: "600" },
  summaryValue: { fontSize: 17, fontWeight: "700", color: colors.primaryDarker },
  muted: { color: colors.textMuted },
});
