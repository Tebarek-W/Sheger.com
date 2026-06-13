import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { colors } from "@/constants/theme";
import { formatDualDateTime } from "@/lib/calendar/ethiopian";

type DualDateTimeProps = {
  iso: string;
  weekday?: boolean;
  compact?: boolean;
  variant?: "light" | "dark";
  style?: ViewStyle;
};

/** Shows Gregorian and Ethiopian calendar date + time together. */
export function DualDateTime({
  iso,
  weekday = true,
  compact,
  variant = "light",
  style,
}: DualDateTimeProps) {
  const dual = formatDualDateTime(iso, { weekday });
  const dark = variant === "dark";

  if (compact) {
    return (
      <View style={[styles.wrap, style]}>
        <Text style={[styles.gcLine, dark && styles.gcLineDark]}>
          {dual.gc} · {dual.gcTime}
        </Text>
        <Text style={[styles.etLine, dark && styles.etLineDark]}>
          {dual.et} · {dual.etTime}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.row}>
        <Text style={[styles.badge, dark && styles.badgeDark]}>GC</Text>
        <View style={styles.textBlock}>
          <Text style={[styles.date, dark && styles.dateDark]}>{dual.gc}</Text>
          <Text style={[styles.time, dark && styles.timeDark]}>{dual.gcTime}</Text>
        </View>
      </View>
      <View style={[styles.divider, dark && styles.dividerDark]} />
      <View style={styles.row}>
        <Text style={[styles.badge, styles.badgeEt, dark && styles.badgeEtDark]}>ET</Text>
        <View style={styles.textBlock}>
          <Text style={[styles.date, dark && styles.dateDark]}>{dual.et}</Text>
          <Text style={[styles.time, dark && styles.timeDark]}>{dual.etTime}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  badge: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    overflow: "hidden",
    marginTop: 2,
  },
  badgeEt: { color: colors.brandDark },
  textBlock: { flex: 1, gap: 2 },
  date: { fontSize: 14, fontWeight: "500", color: colors.text, lineHeight: 20 },
  time: { fontSize: 13, color: colors.textSecondary },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  gcLine: { fontSize: 13, fontWeight: "500", color: colors.text, lineHeight: 18 },
  gcLineDark: { color: "rgba(255,255,255,0.9)" },
  etLine: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  etLineDark: { color: "rgba(255,255,255,0.6)" },
  badgeDark: { backgroundColor: "rgba(255,255,255,0.15)", color: colors.accentLime },
  badgeEtDark: { color: colors.accentLime },
  dateDark: { color: "rgba(255,255,255,0.9)" },
  timeDark: { color: "rgba(255,255,255,0.6)" },
  dividerDark: { backgroundColor: "rgba(255,255,255,0.15)" },
});
