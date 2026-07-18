import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { DualTime } from "@/components/ui/DualTime";
import { colors, radius } from "@/constants/theme";
import {
  ETHIOPIAN_PERIODS,
  ethiopianWallToGc24,
  gc24ToEthiopianWall,
  type EthiopianPeriod,
} from "@/lib/calendar/ethiopian-clock";
import { pad2 } from "@/lib/calendar/timezone";

type EthiopianTimeInputProps = {
  label: string;
  valueGc24: string;
  onChangeGc24: (gc24: string) => void;
};

/**
 * Time entry in Ethiopian clock (hour 1–12 + ጠዋት/ማታ).
 * Stores and emits synchronized GC 24-hour time for the API.
 */
export function EthiopianTimeInput({
  label,
  valueGc24,
  onChangeGc24,
}: EthiopianTimeInputProps) {
  const wall = gc24ToEthiopianWall(valueGc24);
  const [hourText, setHourText] = useState(wall ? String(wall.hour) : "3");
  const [minuteText, setMinuteText] = useState(wall ? pad2(wall.minute) : "00");
  const [period, setPeriod] = useState<EthiopianPeriod>(wall?.period ?? "ጠዋት");

  useEffect(() => {
    const next = gc24ToEthiopianWall(valueGc24);
    if (!next) return;
    setHourText(String(next.hour));
    setMinuteText(pad2(next.minute));
    setPeriod(next.period);
  }, [valueGc24]);

  const tryEmit = (h: string, m: string, p: EthiopianPeriod) => {
    const hour = Number(h);
    if (!Number.isInteger(hour) || hour < 1 || hour > 12) return;
    const minute = Number(m);
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) return;
    const gc = ethiopianWallToGc24({ hour, minute, period: p });
    if (gc) onChangeGc24(gc);
  };

  const onHourChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 2);
    setHourText(cleaned);
    if (cleaned) tryEmit(cleaned, minuteText, period);
  };

  const onMinuteChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 2);
    setMinuteText(cleaned);
    if (cleaned.length >= 1) tryEmit(hourText, cleaned, period);
  };

  const onMinuteBlur = () => {
    if (minuteText.length === 1) {
      const padded = pad2(Number(minuteText));
      setMinuteText(padded);
      tryEmit(hourText, padded, period);
    }
  };

  const onPeriodChange = (p: EthiopianPeriod) => {
    setPeriod(p);
    tryEmit(hourText, minuteText, p);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          value={hourText}
          onChangeText={onHourChange}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="3"
          placeholderTextColor={colors.textTertiary}
          style={styles.hourInput}
        />
        <Text style={styles.colon}>:</Text>
        <TextInput
          value={minuteText}
          onChangeText={onMinuteChange}
          onBlur={onMinuteBlur}
          keyboardType="number-pad"
          maxLength={2}
          placeholder="00"
          placeholderTextColor={colors.textTertiary}
          style={styles.minuteInput}
        />
        <View style={styles.periodRow}>
          {ETHIOPIAN_PERIODS.map((p) => {
            const active = period === p;
            return (
              <Pressable
                key={p}
                onPress={() => onPeriodChange(p)}
                style={[styles.periodBtn, active && styles.periodBtnActive]}
              >
                <Text style={[styles.periodText, active && styles.periodTextActive]}>
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <DualTime hhmm={valueGc24} compact showGc />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontWeight: "500", color: colors.textSecondary, marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  hourInput: {
    width: 40,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    backgroundColor: colors.white,
  },
  colon: { fontSize: 18, fontWeight: "600", color: colors.text },
  minuteInput: {
    width: 44,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
    backgroundColor: colors.white,
  },
  periodRow: { flexDirection: "row", gap: 4, marginLeft: 4 },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.screenBg,
  },
  periodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  periodText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  periodTextActive: { color: colors.primaryDark },
});
