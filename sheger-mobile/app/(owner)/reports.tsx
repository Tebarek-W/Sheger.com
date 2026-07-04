import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchOwnerStats } from "@/lib/api/owner";
import type { BookingStatus } from "@/lib/types/database";

export default function OwnerReportsScreen() {
  const { t } = useI18n();
  const { business } = useOwnerBusiness();

  const { data: stats } = useQuery({
    queryKey: ["owner-stats", business?.id],
    queryFn: () => fetchOwnerStats(business!.id),
    enabled: Boolean(business?.id),
  });

  const byStatus: Record<BookingStatus, number> = {
    pending: (stats as { byStatus?: Record<BookingStatus, number> } | undefined)?.byStatus?.pending ?? 0,
    confirmed: (stats as { byStatus?: Record<BookingStatus, number> } | undefined)?.byStatus?.confirmed ?? 0,
    cancelled: (stats as { byStatus?: Record<BookingStatus, number> } | undefined)?.byStatus?.cancelled ?? 0,
    completed: (stats as { byStatus?: Record<BookingStatus, number> } | undefined)?.byStatus?.completed ?? 0,
  };

  const maxStatus = Math.max(...Object.values(byStatus), 1);

  return (
    <Screen scroll>
      <Header
        title={t("owner.screens.reports.title")}
        subtitle={t("owner.screens.reports.subtitle")}
        showBack
      />

      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("owner.screens.reports.totalRevenue")}</Text>
          <Text style={styles.statValue}>
            ETB {(stats?.totalRevenue ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.statHint}>{t("owner.screens.reports.revenueHint")}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>{t("owner.screens.reports.last30Days")}</Text>
          <Text style={styles.statValue}>
            ETB {(stats?.last30DaysRevenue ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.statHint}>{t("owner.screens.reports.periodHint")}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.miniCard}>
          <Text style={styles.miniValue}>{stats?.totalBookings ?? 0}</Text>
          <Text style={styles.miniLabel}>{t("owner.screens.reports.allBookings")}</Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniValue}>{stats?.pendingBookings ?? 0}</Text>
          <Text style={styles.miniLabel}>{t("owner.screens.reports.pending")}</Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniValue}>{stats?.completedBookings ?? 0}</Text>
          <Text style={styles.miniLabel}>{t("owner.screens.reports.completed")}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t("owner.screens.reports.byStatus")}</Text>
      <View style={styles.bars}>
        {(Object.entries(byStatus) as [BookingStatus, number][]).map(([status, count]) => (
          <View key={status} style={styles.barRow}>
            <View style={styles.barHeader}>
              <Text style={styles.barLabel}>{t(`owner.screens.reports.status.${status}`)}</Text>
              <Text style={styles.barCount}>{count}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, { width: `${(count / maxStatus) * 100}%` }]}
              />
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: ownerLayout.cardGap, marginBottom: ownerLayout.sectionGap },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    ...shadows.sm,
    padding: ownerLayout.cardPadding,
    gap: 6,
  },
  statLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.primaryDarker },
  statHint: { fontSize: 12, color: colors.textMuted },
  miniCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    ...shadows.sm,
    padding: ownerLayout.cardPadding,
    alignItems: "center",
    gap: 4,
  },
  miniValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
  miniLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  sectionTitle: {
    marginTop: ownerLayout.sectionGap,
    marginBottom: ownerLayout.sectionTitleBottom,
    fontSize: 18,
    fontWeight: "700",
    color: colors.primaryDarker,
  },
  bars: { gap: ownerLayout.listGap, paddingBottom: ownerLayout.bottomPadding, ...shadows.sm, backgroundColor: colors.white, borderRadius: radius.lg, padding: ownerLayout.cardPadding },
  barRow: { gap: 6 },
  barHeader: { flexDirection: "row", justifyContent: "space-between" },
  barLabel: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker, textTransform: "capitalize" },
  barCount: { fontSize: 14, fontWeight: "700", color: colors.primaryDarker },
  barTrack: {
    height: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
});
