import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchMyWorkingHours, saveWorkingHours, type WorkingHoursInput } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";

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

  const { data: saved } = useQuery({
    queryKey: ["owner-hours", business?.id],
    queryFn: () => fetchMyWorkingHours(business!.id),
    enabled: Boolean(business?.id),
  });

  useEffect(() => {
    if (!saved?.length) return;
    const merged = DEFAULT_HOURS.map((defaultDay) => {
      const existing = saved.find((h) => h.day_of_week === defaultDay.day_of_week);
      if (!existing) return defaultDay;
      return {
        day_of_week: existing.day_of_week,
        open_time: existing.open_time.slice(0, 5),
        close_time: existing.close_time.slice(0, 5),
        is_closed: existing.is_closed,
      };
    });
    setHours(merged);
  }, [saved]);

  const mutation = useMutation({
    mutationFn: () => saveWorkingHours(business!.id, hours),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-hours", business?.id] });
      Alert.alert("Saved", "Working hours updated.");
    },
    onError: (e) => Alert.alert("Error", getErrorMessage(e)),
  });

  const updateDay = (day: number, patch: Partial<WorkingHoursInput>) => {
    setHours((prev) =>
      prev.map((h) => (h.day_of_week === day ? { ...h, ...patch } : h)),
    );
  };

  return (
    <Screen scroll>
      <Header title="Working hours" subtitle="When customers can book" showBack />

      <View style={styles.list}>
        {hours.map((day) => (
          <View key={day.day_of_week} style={styles.row}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayName}>{DAY_NAMES[day.day_of_week]}</Text>
              <Pressable
                onPress={() => updateDay(day.day_of_week, { is_closed: !day.is_closed })}
              >
                <Text style={styles.closedToggle}>
                  {day.is_closed ? "Closed — tap to open" : "Open — tap to close"}
                </Text>
              </Pressable>
            </View>
            {!day.is_closed ? (
              <View style={styles.times}>
                <View style={styles.timeField}>
                  <Input
                    label="Opens"
                    value={day.open_time}
                    onChangeText={(v) => updateDay(day.day_of_week, { open_time: v })}
                    placeholder="09:00"
                  />
                </View>
                <View style={styles.timeField}>
                  <Input
                    label="Closes"
                    value={day.close_time}
                    onChangeText={(v) => updateDay(day.day_of_week, { close_time: v })}
                    placeholder="18:00"
                  />
                </View>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      <Button title="Save hours" onPress={() => mutation.mutate()} loading={mutation.isPending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, marginBottom: 24 },
  row: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dayName: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  closedToggle: { fontSize: 12, fontWeight: "600", color: colors.primary },
  times: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1 },
});
