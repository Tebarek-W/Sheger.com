import { StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import type { BusinessStatus } from "@/lib/types/database";

const STATUS_KEYS: Record<BusinessStatus, string> = {
  pending: "owner.status.pending",
  approved: "owner.status.approved",
  rejected: "owner.status.rejected",
  suspended: "owner.status.suspended",
};

export function StatusBadge({ status }: { status: BusinessStatus }) {
  const { t } = useI18n();
  const isLive = status === "approved";

  return (
    <View style={[styles.badge, isLive ? styles.live : styles.default]}>
      <Text style={[styles.text, isLive ? styles.liveText : styles.defaultText]}>
        {t(STATUS_KEYS[status])}
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
