import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { DualDateTime } from "@/components/ui/DualDateTime";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { dateToEthiopian, formatMonthDual } from "@/lib/calendar/ethiopian";
import { dayOfWeekInAddis } from "@/lib/calendar/timezone";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { fetchAvailableSlotsForDate, slotInstantKey } from "@/lib/api/slots";
import { fetchWorkingHours } from "@/lib/api/bookings";
import { formatSlotTimeDual } from "@/lib/booking/slots";
import { useBookingStore } from "@/stores/bookingStore";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

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

  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const { data: workingHours, isLoading: hoursLoading } = useQuery({
    queryKey: ["working-hours", business?.id, selectedDate.toDateString()],
    queryFn: () => fetchWorkingHours(business!.id, dayOfWeekInAddis(selectedDate)),
    enabled: Boolean(business?.id),
    refetchInterval: 30_000,
  });

  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ["available-slots", business?.id, selectedDate.toDateString()],
    queryFn: () => fetchAvailableSlotsForDate(business!.id, selectedDate),
    enabled: Boolean(business?.id) && !workingHours?.is_closed,
    refetchInterval: 8_000,
    refetchOnMount: "always",
  });

  const bookableSlots = availableSlots?.filter((s) => !s.isFull) ?? [];
  const hasFullSlots = (availableSlots?.some((s) => s.isFull) ?? false) && bookableSlots.length === 0;

  const calendarDays = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    return cells;
  }, [viewMonth]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const shiftMonth = (delta: number) => {
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const pickDate = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    if (d < today) return;
    setSelectedDate(d);
    setScheduledAt(null);
  };

  if (!business || !service) {
    return (
      <Screen padded={false}>
        <View style={styles.pad}>
          <BookingHeader title="Booking" />
          <Text style={styles.muted}>Select a service first.</Text>
        </View>
      </Screen>
    );
  }

  const loading = hoursLoading || slotsLoading;
  const monthDual = formatMonthDual(viewMonth);

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        <BookingHeader title={service.name} />

        <Text style={styles.sectionLabel}>Staff member</Text>
        <View style={styles.staffRow}>
          <View style={styles.staffItem}>
            <View style={[styles.staffAvatar, styles.staffSelected]}>
              <Text style={styles.staffInitials}>Any</Text>
            </View>
            <Text style={styles.staffName}>Any available</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Select date</Text>
        <View style={styles.calendar}>
          <View style={styles.calHeader}>
            <View style={styles.calMonthBlock}>
              <Text style={styles.calMonth}>{monthDual.gc}</Text>
              <Text style={styles.calMonthEt}>{monthDual.et}</Text>
            </View>
            <View style={styles.calNav}>
              <Pressable onPress={() => shiftMonth(-1)} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>‹</Text>
              </Pressable>
              <Pressable onPress={() => shiftMonth(1)} style={styles.calNavBtn}>
                <Text style={styles.calNavText}>›</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.calWeek}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.calWeekDay}>
                {d}
              </Text>
            ))}
          </View>
          <Text style={styles.calLegend}>GC day · ET day below</Text>
          <View style={styles.calGrid}>
            {calendarDays.map((date, i) => {
              if (!date) {
                return <View key={`empty-${i}`} style={styles.calCell} />;
              }
              const isPast = date < today;
              const isToday = date.toDateString() === today.toDateString();
              const isSelected = date.toDateString() === selectedDate.toDateString();
              const etDay = dateToEthiopian(date).day;
              return (
                <Pressable
                  key={date.toISOString()}
                  disabled={isPast}
                  onPress={() => pickDate(date)}
                  style={[
                    styles.calCell,
                    isToday && styles.calToday,
                    isSelected && !isToday && styles.calSelected,
                    isPast && styles.calPast,
                  ]}
                >
                  <Text
                    style={[
                      styles.calDayText,
                      isToday && styles.calDayTextToday,
                      isSelected && !isToday && styles.calDayTextSelected,
                      isPast && styles.calDayTextPast,
                    ]}
                  >
                    {date.getDate()}
                  </Text>
                  <Text
                    style={[
                      styles.calDayEt,
                      isToday && styles.calDayTextToday,
                      isSelected && !isToday && styles.calDayTextSelected,
                      isPast && styles.calDayTextPast,
                    ]}
                  >
                    {etDay}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Available times (Ethiopian)</Text>
        {workingHours?.is_closed ? (
          <Text style={styles.muted}>This business is closed on this day.</Text>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !availableSlots?.length ? (
          <Text style={styles.muted}>No slots available for this day.</Text>
        ) : hasFullSlots ? (
          <Text style={styles.muted}>All time slots are full for this day.</Text>
        ) : (
          <View style={styles.timeGrid}>
            {availableSlots.map((slot) => {
              const active =
                Boolean(scheduledAt) &&
                slotInstantKey(scheduledAt!) === slotInstantKey(slot.scheduledAt);
              const time = formatSlotTimeDual(slot.scheduledAt);
              if (!time) return null;
              const disabled = slot.isFull;
              return (
                <Pressable
                  key={slot.id}
                  disabled={disabled}
                  style={[
                    styles.timeSlot,
                    active && styles.timeSlotActive,
                    disabled && styles.timeSlotFull,
                  ]}
                  onPress={() => setScheduledAt(slot.scheduledAt)}
                >
                  <Text
                    style={[
                      styles.timeText,
                      active && styles.timeTextActive,
                      disabled && styles.timeTextDisabled,
                    ]}
                  >
                    {time.et}
                  </Text>
                  <Text
                    style={[
                      styles.timeTextGc,
                      active && styles.timeTextGcActive,
                      disabled && styles.timeTextDisabled,
                    ]}
                  >
                    24h {time.gc24}
                  </Text>
                  {disabled ? (
                    <Text style={styles.fullBadge}>Full</Text>
                  ) : slot.maxCapacity > 1 ? (
                    <Text style={[styles.capacityText, active && styles.timeTextActive]}>
                      {slot.remainingCapacity} left
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {scheduledAt ? (
          <View style={styles.footer}>
            <DualDateTime iso={scheduledAt} />
            <Button title="Continue to payment" onPress={() => router.push("/(app)/payment")} />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
    marginTop: 20,
  },
  staffRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  staffItem: { alignItems: "center", gap: 6 },
  staffAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  staffSelected: { borderWidth: 2, borderColor: colors.primary },
  staffInitials: { fontSize: 14, fontWeight: "500", color: colors.primary },
  staffName: { fontSize: 10, color: colors.textSecondary },
  calendar: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 4,
  },
  calHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calMonthBlock: { flex: 1, gap: 2 },
  calMonth: { fontSize: 13, fontWeight: "500", color: colors.text },
  calMonthEt: { fontSize: 11, color: colors.textSecondary },
  calNav: { flexDirection: "row", gap: 8 },
  calNavBtn: { padding: 4 },
  calNavText: { fontSize: 18, color: colors.textSecondary },
  calWeek: { flexDirection: "row", marginBottom: 6 },
  calWeekDay: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "500",
    color: colors.textTertiary,
  },
  calLegend: {
    fontSize: 9,
    color: colors.textTertiary,
    textAlign: "center",
    marginBottom: 4,
  },
  calGrid: { flexDirection: "row", flexWrap: "wrap" },
  calCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  calToday: { backgroundColor: colors.primary },
  calSelected: { backgroundColor: colors.primaryLight },
  calPast: { opacity: 0.35 },
  calDayText: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
  calDayEt: { fontSize: 9, color: colors.textTertiary, marginTop: 1 },
  calDayTextToday: { color: colors.white, fontWeight: "500" },
  calDayTextSelected: { color: colors.primaryDark, fontWeight: "500" },
  calDayTextPast: { color: colors.textTertiary },
  timeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  timeSlot: {
    width: "31%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  timeSlotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  timeSlotFull: {
    opacity: 0.55,
    backgroundColor: colors.screenBg,
    borderColor: colors.border,
  },
  timeText: { fontSize: 13, fontWeight: "600", color: colors.text },
  timeTextDisabled: { color: colors.textTertiary },
  timeTextGc: { fontSize: 10, color: colors.textTertiary, marginTop: 2 },
  timeTextGcActive: { color: colors.primaryDark },
  capacityText: { fontSize: 9, color: colors.textTertiary, marginTop: 3 },
  fullBadge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.error,
    marginTop: 4,
    textTransform: "uppercase",
  },
  timeTextActive: { color: colors.primaryDark, fontWeight: "500" },
  footer: { marginTop: 24, gap: 12 },
  muted: { color: colors.textMuted, fontSize: 14 },
});
