import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { DualDateTime } from "@/components/ui/DualDateTime";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { dateToEthiopian, formatMonthDual } from "@/lib/calendar/ethiopian";
import { addisToday, dayOfWeekInAddis } from "@/lib/calendar/timezone";
import { useI18n } from "@/hooks/useI18n";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { useSlotRealtimeRefresh } from "@/hooks/useSlotRealtime";
import { fetchAvailableSlotsForDate, slotInstantKey } from "@/lib/api/slots";
import { fetchWorkingHours } from "@/lib/api/bookings";
import { fetchBusinessEmployees } from "@/lib/api/businesses";
import { formatSlotTimeDual } from "@/lib/booking/slots";
import type { Employee } from "@/lib/types/database";
import { useBookingStore } from "@/stores/bookingStore";

const WEEKDAY_KEYS = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;

function staffInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function BookScreen() {
  return (
    <RequireAuth>
      <BookScreenContent />
    </RequireAuth>
  );
}

function BookScreenContent() {
  const { t } = useI18n();
  const business = useBookingStore((s) => s.business);
  const service = useBookingStore((s) => s.service);
  const employeeId = useBookingStore((s) => s.employeeId);
  const setEmployeeId = useBookingStore((s) => s.setEmployeeId);
  const setScheduledAt = useBookingStore((s) => s.setScheduledAt);
  const scheduledAt = useBookingStore((s) => s.scheduledAt);

  const [viewMonth, setViewMonth] = useState(() => {
    const d = addisToday();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => addisToday());

  const { data: employees } = useQuery({
    queryKey: ["business-employees", business?.id],
    queryFn: () => fetchBusinessEmployees(business!.id),
    enabled: Boolean(business?.id),
  });

  const { data: workingHours, isLoading: hoursLoading } = useQuery({
    queryKey: ["working-hours", business?.id, selectedDate.toDateString()],
    queryFn: () => fetchWorkingHours(business!.id, dayOfWeekInAddis(selectedDate)),
    enabled: Boolean(business?.id),
    refetchInterval: 30_000,
  });

  const hoursConfigured = Boolean(workingHours);
  const isOpenDay = hoursConfigured && !workingHours!.is_closed;

  useSlotRealtimeRefresh(business?.id, selectedDate, employeeId);

  const { data: availableSlots, isLoading: slotsLoading } = useQuery({
    queryKey: ["available-slots", business?.id, selectedDate.toDateString(), employeeId],
    queryFn: () => fetchAvailableSlotsForDate(business!.id, selectedDate, employeeId),
    enabled: Boolean(business?.id) && isOpenDay,
    refetchOnMount: "always",
  });

  const bookableSlots = availableSlots?.filter((s) => !s.isFull) ?? [];
  const hasFullSlots = (availableSlots?.some((s) => s.isFull) ?? false) && bookableSlots.length === 0;

  useEffect(() => {
    if (!scheduledAt || !availableSlots) return;
    const match = availableSlots.find(
      (s) => slotInstantKey(s.scheduledAt) === slotInstantKey(scheduledAt),
    );
    if (!match || match.isFull) {
      setScheduledAt(null);
    }
  }, [availableSlots, scheduledAt, setScheduledAt]);

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

  const today = useMemo(() => addisToday(), []);

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

  const pickEmployee = (id: string | null) => {
    setEmployeeId(id);
    setScheduledAt(null);
  };

  if (!business || !service) {
    return (
      <Screen padded={false}>
        <View style={styles.pad}>
          <BookingHeader title={t("booking.title")} />
          <Text style={styles.muted}>{t("booking.selectServiceFirst")}</Text>
        </View>
      </Screen>
    );
  }

  const loading = hoursLoading || slotsLoading;
  const monthDual = formatMonthDual(viewMonth);
  const showStaffPicker = (employees?.length ?? 0) > 0;

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        <BookingHeader title={service.name} />

        {showStaffPicker ? (
          <>
            <Text style={styles.sectionLabel}>
              {t("booking.staff")} · {t("booking.staffOptional")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.staffRow}
            >
              <Pressable style={styles.staffItem} onPress={() => pickEmployee(null)}>
                <View style={[styles.staffAvatar, employeeId === null && styles.staffSelected]}>
                  <Text style={styles.staffInitials}>★</Text>
                </View>
                <Text style={styles.staffName}>{t("booking.anyAvailable")}</Text>
              </Pressable>
              {employees!.map((employee: Employee) => {
                const active = employeeId === employee.id;
                return (
                  <Pressable
                    key={employee.id}
                    style={styles.staffItem}
                    onPress={() => pickEmployee(employee.id)}
                  >
                    <View style={[styles.staffAvatar, active && styles.staffSelected]}>
                      <Text style={styles.staffInitials}>{staffInitials(employee.full_name)}</Text>
                    </View>
                    <Text style={styles.staffName} numberOfLines={1}>
                      {employee.full_name.split(" ")[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>{t("booking.selectDate")}</Text>
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
            {WEEKDAY_KEYS.map((key) => (
              <Text key={key} style={styles.calWeekDay}>
                {t(`booking.weekdays.${key}`)}
              </Text>
            ))}
          </View>
          <Text style={styles.calLegend}>{t("booking.gcEtLegend")}</Text>
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

        <Text style={styles.sectionLabel}>{t("booking.availableTimes")}</Text>
        {hoursLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !hoursConfigured ? (
          <Text style={styles.muted}>{t("booking.hoursNotSet")}</Text>
        ) : workingHours?.is_closed ? (
          <Text style={styles.muted}>{t("booking.closedToday")}</Text>
        ) : loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !availableSlots?.length ? (
          <Text style={styles.muted}>{t("booking.noSlots")}</Text>
        ) : hasFullSlots ? (
          <Text style={styles.muted}>{t("booking.allFull")}</Text>
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
                    <Text style={styles.fullBadge}>{t("booking.full")}</Text>
                  ) : slot.maxCapacity > 1 ? (
                    <Text style={[styles.capacityText, active && styles.timeTextActive]}>
                      {t("booking.left", { count: slot.remainingCapacity })}
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
            <Button
              title={t("booking.continueToPayment")}
              onPress={() => router.push("/(app)/payment")}
            />
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
  staffRow: { flexDirection: "row", gap: 12, marginBottom: 4, paddingRight: 8 },
  staffItem: { alignItems: "center", gap: 6, maxWidth: 72 },
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
  staffName: { fontSize: 10, color: colors.textSecondary, textAlign: "center" },
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
