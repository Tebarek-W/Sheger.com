import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { DualTime } from "@/components/ui/DualTime";
import { EthiopianTimeInput } from "@/components/ui/EthiopianTimeInput";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import {
  createAppointmentSlot,
  deleteAppointmentSlot,
  fetchAppointmentSlots,
  type AppointmentSlotInput,
} from "@/lib/api/slots";
import { fetchMyWorkingHours, saveWorkingHours, type WorkingHoursInput } from "@/lib/api/owner";
import {
  formatEthiopianWallLabel,
  gc24ToEthiopianWall,
} from "@/lib/calendar/ethiopian-clock";
import { formatTimeFromDb, normalizeTime24 } from "@/lib/calendar/timezone";
import { getErrorMessage } from "@/lib/errors";
import type { AppointmentSlot } from "@/lib/types/database";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const DEFAULT_HOURS: WorkingHoursInput[] = Array.from({ length: 7 }, (_, day) => ({
  day_of_week: day,
  open_time: "09:00",
  close_time: "18:00",
  is_closed: day === 0,
}));

export default function OwnerHoursScreen() {
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [hours, setHours] = useState<WorkingHoursInput[]>(DEFAULT_HOURS);
  const [activeDay, setActiveDay] = useState(1);
  const [newSlotTime, setNewSlotTime] = useState("09:00");
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
      Alert.alert("Saved", "Working hours updated.");
    },
    onError: (e) => Alert.alert("Error", getErrorMessage(e)),
  });

  const addSlotMutation = useMutation({
    mutationFn: (input: AppointmentSlotInput) => createAppointmentSlot(business!.id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-slots", business?.id] });
      setNewSlotTime("09:00");
      setNewSlotCapacity("1");
    },
    onError: (e) => Alert.alert("Could not add slot", getErrorMessage(e)),
  });

  const removeSlotMutation = useMutation({
    mutationFn: (slotId: string) => deleteAppointmentSlot(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-slots", business?.id] });
    },
    onError: (e) => Alert.alert("Error", getErrorMessage(e)),
  });

  const updateDay = (day: number, patch: Partial<WorkingHoursInput>) => {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)));
  };

  const addSlot = () => {
    if (dayHours.is_closed) {
      Alert.alert("Day closed", "Open this day before adding appointment slots.");
      return;
    }
    const time = normalizeTime24(newSlotTime);
    if (!time) {
      Alert.alert("Invalid time", "Enter hour (1–12), minutes, and ጠዋት or ማታ.");
      return;
    }
    const capacity = Number(newSlotCapacity);
    if (!Number.isInteger(capacity) || capacity < 1) {
      Alert.alert("Invalid capacity", "Enter a whole number of 1 or more.");
      return;
    }
    const openM = timeToMin(dayHours.open_time);
    const closeM = timeToMin(dayHours.close_time);
    const slotM = timeToMin(time);
    if (slotM < openM || slotM >= closeM) {
      const openEt = gc24ToEthiopianWall(dayHours.open_time);
      const closeEt = gc24ToEthiopianWall(dayHours.close_time);
      Alert.alert(
        "Outside hours",
        `Slot must be between ${openEt ? formatEthiopianWallLabel(openEt) : dayHours.open_time} and ${closeEt ? formatEthiopianWallLabel(closeEt) : dayHours.close_time}.`,
      );
      return;
    }
    addSlotMutation.mutate({
      day_of_week: activeDay,
      start_time: time,
      max_capacity: capacity,
    });
  };

  return (
    <Screen scroll>
      <Header
        title="Hours & slots"
        subtitle="Set opening hours and bookable time slots with capacity"
        showBack
      />

      <Text style={styles.sectionTitle}>Day</Text>
      <View style={styles.dayTabs}>
        {DAY_NAMES.map((name, day) => {
          const active = activeDay === day;
          const closed = hours.find((h) => h.day_of_week === day)?.is_closed;
          return (
            <Pressable
              key={name}
              onPress={() => setActiveDay(day)}
              style={[styles.dayTab, active && styles.dayTabActive]}
            >
              <Text style={[styles.dayTabText, active && styles.dayTabTextActive]}>
                {name.slice(0, 3)}
              </Text>
              {closed ? <Text style={styles.closedDot}>✕</Text> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{DAY_NAMES[activeDay]}</Text>
        <Pressable onPress={() => updateDay(activeDay, { is_closed: !dayHours.is_closed })}>
          <Text style={styles.toggle}>
            {dayHours.is_closed ? "Closed — tap to open" : "Open — tap to mark closed"}
          </Text>
        </Pressable>

        {!dayHours.is_closed ? (
          <>
            <View style={styles.times}>
              <View style={styles.timeField}>
                <EthiopianTimeInput
                  label="Opens (Ethiopian)"
                  valueGc24={dayHours.open_time}
                  onChangeGc24={(v) => updateDay(activeDay, { open_time: v })}
                />
              </View>
              <View style={styles.timeField}>
                <EthiopianTimeInput
                  label="Closes (Ethiopian)"
                  valueGc24={dayHours.close_time}
                  onChangeGc24={(v) => updateDay(activeDay, { close_time: v })}
                />
              </View>
            </View>
            <Button
              title="Save working hours"
              variant="outline"
              onPress={() => saveHoursMutation.mutate()}
              loading={saveHoursMutation.isPending}
            />
          </>
        ) : null}
      </View>

      {!dayHours.is_closed ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Appointment slots</Text>
          <Text style={styles.cardHint}>
            Customers can only book configured slots. Each slot has a maximum number of
            bookings. Past slots become unavailable automatically.
          </Text>

          {daySlots.length === 0 ? (
            <Text style={styles.emptySlots}>No slots for this day yet.</Text>
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
            <Text style={styles.addLabel}>Add slot</Text>
            <EthiopianTimeInput
              label="Start time (Ethiopian)"
              valueGc24={newSlotTime}
              onChangeGc24={setNewSlotTime}
            />
            <Input
              label="Max bookings"
              value={newSlotCapacity}
              onChangeText={setNewSlotCapacity}
              placeholder="1"
              keyboardType="number-pad"
            />
            <Button
              title="Add time slot"
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
  const time = formatTimeFromDb(slot.start_time);
  return (
    <View style={styles.slotRow}>
      <View style={styles.slotInfo}>
        <DualTime hhmm={time} compact />
        <Text style={styles.capacity}>
          Capacity: {slot.max_capacity} booking{slot.max_capacity === 1 ? "" : "s"}
        </Text>
      </View>
      <Pressable onPress={onDelete} disabled={deleting} style={styles.deleteBtn}>
        <Text style={styles.deleteText}>Remove</Text>
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
    marginBottom: 8,
  },
  dayTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
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
    padding: 14,
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  cardHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  toggle: { fontSize: 12, fontWeight: "600", color: colors.primary },
  times: { flexDirection: "column", gap: 14 },
  timeField: { gap: 4 },
  emptySlots: { fontSize: 13, color: colors.textMuted, fontStyle: "italic" },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    padding: 12,
    gap: 10,
  },
  slotInfo: { flex: 1, gap: 4 },
  capacity: { fontSize: 11, color: colors.textSecondary },
  deleteBtn: { padding: 6 },
  deleteText: { fontSize: 12, fontWeight: "600", color: colors.error },
  addSlot: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 10,
  },
  addLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
});
