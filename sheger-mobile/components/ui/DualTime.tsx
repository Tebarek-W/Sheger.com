import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/theme";
import { formatWallClockDual } from "@/lib/booking/slots";

type DualTimeProps = {
  hhmm: string;
  compact?: boolean;
  /** When true, also show GC 24-hour line (default: true). */
  showGc?: boolean;
};

/** Ethiopian clock primary; European 24-hour (GC) secondary — always synchronized. */
export function DualTime({ hhmm, compact, showGc = true }: DualTimeProps) {
  const dual = formatWallClockDual(hhmm);
  if (!dual) return null;

  if (compact) {
    return (
      <View style={styles.compact}>
        <Text style={styles.etPrimary}>{dual.et}</Text>
        {showGc ? <Text style={styles.gcSecondary}>24h {dual.gc24}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={[styles.badge, styles.badgeEt]}>ET</Text>
        <Text style={styles.etPrimary}>{dual.et}</Text>
      </View>
      {showGc ? (
        <View style={styles.row}>
          <Text style={styles.badge}>24h</Text>
          <Text style={styles.gcSecondary}>{dual.gc24}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  compact: { gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: "hidden",
  },
  badgeEt: { color: colors.brandDark },
  etPrimary: { fontSize: 14, fontWeight: "600", color: colors.text },
  gcSecondary: { fontSize: 11, color: colors.textSecondary },
});
