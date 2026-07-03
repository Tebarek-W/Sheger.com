import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { DualTime } from "@/components/ui/DualTime";
import { EthiopianTimeInput } from "@/components/ui/EthiopianTimeInput";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import {
  createAppointmentSlot,
  deleteAppointmentSlot,
  fetchAppointmentSlots,
  type AppointmentSlotInput,
} from "@/lib/api/slots";
import { fetchMyWorkingHours, saveWorkingHours, type WorkingHoursInput } from "@/lib/api/owner";
import {
  buildDefaultWorkingHours,
  DEFAULT_OPEN_TIME_GC,
} from "@/lib/business/default-working-hours";
import {
  formatEthiopianWallLabel,
  gc24ToEthiopianWall,
} from "@/lib/calendar/ethiopian-clock";
import { formatTimeFromDb, normalizeTime24 } from "@/lib/calendar/timezone";
import { getErrorMessage } from "@/lib/errors";
import type { AppointmentSlot } from "@/lib/types/database";

const DAY_KEYS = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;

const DEFAULT_HOURS = buildDefaultWorkingHours();

export default function OwnerHoursScreen() {
  const { t } = useI18n();
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<WorkingHoursInput[]>(DEFAULT_HOURS);
  const [activeDay, setActiveDay] = useState(1);
  const [newSlotTime, setNewSlotTime] = useState(DEFAULT_OPEN_TIME_GC);
  const [newSlotCapacity, setNewSlotCapacity] = useState("1");

  const { data: saved } = useQuery({
    queryKey: ["owner-hours", business?.id],
    queryFn: () => fetchMyWorkingHours(business!.id),
    enabled: Boolean(business?.id),
  });

  const { data: allSlots } = useQuery({
    queryKey: ["owner-slots", business?.id],
    queryFn: () => fetchAppointmentSlots(business!.id),
    enabled: Boolean(business?.id),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    if (!saved?.length) return;
    const merged = DEFAULT_HOURS.map((defaultDay) => {
      const existing = saved.find((h) => h.day_of_week === defaultDay.day_of_week);
      if (!existing) return defaultDay;
      return {
        day_of_week: existing.day_of_week,
        open_time: formatTimeFromDb(existing.open_time),
        close_time: formatTimeFromDb(existing.close_time),
        is_closed: existing.is_closed,
      };
    });
    setHours(merged);
  }, [saved]);

  const dayHours = hours.find((h) => h.day_of_week === activeDay)!;
  const daySlots = useMemo(
    () =>
      (allSlots ?? [])
        .filter((s) => s.day_of_week === activeDay)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [allSlots, activeDay],
  );

  const saveHoursMutation = useMutation({
    mutationFn: () => saveWorkingHours(business!.id, hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-hours", business?.id] });
      Alert.alert(t("owner.screens.hours.savedTitle"), t("owner.screens.hours.savedMessage"));
    },
    onError: (e) => Alert.alert(t("common.error"), getErrorMessage(e)),
  });

  const addSlotMutation = useMutation({
    mutationFn: (input: AppointmentSlotInput) => createAppointmentSlot(business!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-slots", business?.id] });
      setNewSlotTime(DEFAULT_OPEN_TIME_GC);
      setNewSlotCapacity("1");
    },
    onError: (e) => Alert.alert(t("owner.screens.hours.addSlotFailedTitle"), getErrorMessage(e)),
  });

  const removeSlotMutation = useMutation({
    mutationFn: (slotId: string) => deleteAppointmentSlot(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-slots", business?.id] });
    },
    onError: (e) => Alert.alert(t("common.error"), getErrorMessage(e)),
  });

  const updateDay = (day: number, patch: Partial<WorkingHoursInput>) => {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)));
  };

  const addSlot = () => {
    if (dayHours.is_closed) {
      Alert.alert(
        t("owner.screens.hours.dayClosedTitle"),
        t("owner.screens.hours.dayClosedMessage"),
      );
      return;
    }
    const time = normalizeTime24(newSlotTime);
    if (!time) {
      Alert.alert(
        t("owner.screens.hours.invalidTimeTitle"),
        t("owner.screens.hours.invalidTimeMessage"),
      );
      return;
    }
    const capacity = Number(newSlotCapacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      Alert.alert(
        t("owner.screens.hours.invalidCapacityTitle"),
        t("owner.screens.hours.invalidCapacityMessage"),
      );
      return;
    }
    const openM = timeToMin(dayHours.open_time);
    const closeM = timeToMin(dayHours.close_time);
    const slotM = timeToMin(time);
    if (slotM < openM || slotM >= closeM) {
      const openEt = gc24ToEthiopianWall(dayHours.open_time);
      const closeEt = gc24ToEthiopianWall(dayHours.close_time);
      Alert.alert(
        t("owner.screens.hours.outsideHoursTitle"),
        t("owner.screens.hours.outsideHoursMessage", {
          open: openEt ? formatEthiopianWallLabel(openEt) : dayHours.open_time,
          close: closeEt ? formatEthiopianWallLabel(closeEt) : dayHours.close_time,
        }),
      );
      return;
    }
    addSlotMutation.mutate({
      day_of_week: activeDay,
      start_time: time,
      max_capacity: capacity,
    });
  };

  const activeDayKey = DAY_KEYS[activeDay];

  return (
    <Screen scroll>
      <Header
        title={t("owner.screens.hours.title")}
        subtitle={t("owner.screens.hours.subtitle")}
        showBack
      />

      <Text style={styles.sectionTitle}>{t("owner.screens.hours.day")}</Text>
      <View style={styles.dayTabs}>
        {DAY_KEYS.map((key, day) => {
          const active = activeDay === day;
          const closed = hours.find((h) => h.day_of_week === day)?.is_closed;
          return (
            <Pressable
              key={key}
              onPress={() => setActiveDay(day)}
              style={[styles.dayTab, active && styles.dayTabActive]}
            >
              <Text style={[styles.dayTabText, active && styles.dayTabTextActive]}>
                {t(`booking.weekdays.${key}`)}
              </Text>
              {closed ? <Text style={styles.closedDot}>✕</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t(`owner.screens.hours.days.${activeDayKey}`)}</Text>
        <Pressable onPress={() => updateDay(activeDay, { is_closed: !dayHours.is_closed })}>
          <Text style={styles.toggle}>
            {dayHours.is_closed
              ? t("owner.screens.hours.closedTapOpen")
              : t("owner.screens.hours.openTapClose")}
          </Text>
        </Pressable>

        {!dayHours.is_closed ? (
          <>
            <View style={styles.times}>
              <View style={styles.timeField}>
                <EthiopianTimeInput
                  label={t("owner.screens.hours.opensLabel")}
                  valueGc24={dayHours.open_time}
                  onChangeGc24={(v) => updateDay(activeDay, { open_time: v })}
                />
              </View>
              <View style={styles.timeField}>
                <EthiopianTimeInput
                  label={t("owner.screens.hours.closesLabel")}
                  valueGc24={dayHours.close_time}
                  onChangeGc24={(v) => updateDay(activeDay, { close_time: v })}
                />
              </View>
            </View>
            <Button
              title={t("owner.screens.hours.saveHours")}
              variant="outline"
              onPress={() => saveHoursMutation.mutate()}
              loading={saveHoursMutation.isPending}
            />
          </>
        ) : null}
      </View>

      {!dayHours.is_closed ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("owner.screens.hours.slotsTitle")}</Text>
          <Text style={styles.cardHint}>{t("owner.screens.hours.slotsHint")}</Text>

          {daySlots.length === 0 ? (
            <Text style={styles.emptySlots}>{t("owner.screens.hours.noSlots")}</Text>
          ) : (
            daySlots.map((slot) => (
              <SlotRow
                key={slot.id}
                slot={slot}
                onDelete={() => removeSlotMutation.mutate(slot.id)}
                deleting={removeSlotMutation.isPending}
              />
            ))
          )}

          <View style={styles.addSlot}>
            <Text style={styles.addLabel}>{t("owner.screens.hours.addSlot")}</Text>
            <EthiopianTimeInput
              label={t("owner.screens.hours.startTime")}
              valueGc24={newSlotTime}
              onChangeGc24={setNewSlotTime}
            />
            <Input
              label={t("owner.screens.hours.maxBookings")}
              value={newSlotCapacity}
              onChangeText={setNewSlotCapacity}
              placeholder="1"
              keyboardType="number-pad"
            />
            <Button
              title={t("owner.screens.hours.addTimeSlot")}
              onPress={addSlot}
              loading={addSlotMutation.isPending}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function timeToMin(time: string) {
  const [h, m] = time.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function SlotRow({
  slot,
  onDelete,
  deleting,
}: {
  slot: AppointmentSlot;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { t } = useI18n();
  const time = formatTimeFromDb(slot.start_time);
  return (
    <View style={styles.slotRow}>
      <View style={styles.slotInfo}>
        <DualTime hhmm={time} compact />
        <Text style={styles.capacity}>
          {slot.max_capacity === 1
            ? t("owner.screens.hours.capacity", { count: slot.max_capacity })
            : t("owner.screens.hours.capacityPlural", { count: slot.max_capacity })}
        </Text>
      </View>
      <Pressable onPress={onDelete} disabled={deleting} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>{t("owner.screens.hours.remove")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: ownerLayout.blockGap / 2,
  },
  dayTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: ownerLayout.cardPadding },
  dayTab: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    minWidth: 44,
  },
  dayTabActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  dayTabText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  dayTabTextActive: { color: colors.primaryDark },
  closedDot: { fontSize: 8, color: colors.error, marginTop: 2 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: ownerLayout.cardPadding,
    gap: ownerLayout.cardGap,
    marginBottom: ownerLayout.cardPadding,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  cardHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  toggle: { fontSize: 12, fontWeight: "600", color: colors.primary },
  times: { flexDirection: "column", gap: ownerLayout.cardPadding },
  timeField: { gap: 4 },
  emptySlots: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    padding: ownerLayout.cardPadding,
    gap: ownerLayout.listGap,
  },
  slotInfo: { flex: 1, gap: 4 },
  capacity: { fontSize: 11, color: colors.textSecondary },
  deleteBtn: { padding: 6 },
  deleteText: { fontSize: 12, fontWeight: "600", color: colors.error },
  addSlot: {
    marginTop: ownerLayout.blockGap / 2,
    paddingTop: ownerLayout.cardGap,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: ownerLayout.listGap,
  },
  addLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
});
