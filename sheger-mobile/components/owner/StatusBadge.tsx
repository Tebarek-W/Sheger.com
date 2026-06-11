import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import type { BusinessStatus } from "@/lib/types/database";

const labels: Record<BusinessStatus, string> = {
  pending: "Pending approval",
  approved: "Live",
  rejected: "Rejected",
  suspended: "Suspended",
};

export function StatusBadge({ status }: { status: BusinessStatus }) {
  const isLive = status === "approved";

  return (
    <View style={[styles.badge, isLive ? styles.live : styles.default]}>
      <Text style={[styles.text, isLive ? styles.liveText : styles.defaultText]}>
        {labels[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  live: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  text: { fontSize: 12, fontWeight: "700" },
  liveText: { color: colors.white },
  defaultText: { color: colors.primaryDarker },
});
