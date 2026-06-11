import { useQuery } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchMyBookings, fetchOwnerStats } from "@/lib/api/owner";
import type { BookingStatus } from "@/lib/types/database";

export default function OwnerReportsScreen() {
  const { business } = useOwnerBusiness();

  const { data: stats } = useQuery({
    queryKey: ["owner-stats", business?.id],
    queryFn: () => fetchOwnerStats(business!.id),
    enabled: Boolean(business?.id),
  });

  const { data: bookings } = useQuery({
    queryKey: ["owner-bookings", business?.id],
    queryFn: () => fetchMyBookings(business!.id),
    enabled: Boolean(business?.id),
  });

  const byStatus: Record<BookingStatus, number> = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
  };

  bookings?.forEach((b) => {
    byStatus[b.status] += 1;
  });

  const maxStatus = Math.max(...Object.values(byStatus), 1);

  return (
    <Screen scroll>
      <Header title="Income & reports" subtitle="Track your business performance" showBack />

      <View style={styles.grid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total revenue</Text>
          <Text style={styles.statValue}>
            ETB {(stats?.totalRevenue ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.statHint}>From completed bookings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Last 30 days</Text>
          <Text style={styles.statValue}>
            ETB {(stats?.last30DaysRevenue ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.statHint}>Completed in period</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <View style={styles.miniCard}>
          <Text style={styles.miniValue}>{stats?.totalBookings ?? 0}</Text>
          <Text style={styles.miniLabel}>All bookings</Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniValue}>{stats?.pendingBookings ?? 0}</Text>
          <Text style={styles.miniLabel}>Pending</Text>
        </View>
        <View style={styles.miniCard}>
          <Text style={styles.miniValue}>{stats?.completedBookings ?? 0}</Text>
          <Text style={styles.miniLabel}>Completed</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Bookings by status</Text>
      <View style={styles.bars}>
        {(Object.entries(byStatus) as [BookingStatus, number][]).map(([status, count]) => (
          <View key={status} style={styles.barRow}>
            <View style={styles.barHeader}>
              <Text style={styles.barLabel}>{status}</Text>
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
  grid: { flexDirection: "row", gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  statLabel: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
  statValue: { fontSize: 24, fontWeight: "800", color: colors.primaryDarker },
  statHint: { fontSize: 12, color: colors.textMuted },
  miniCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  miniValue: { fontSize: 20, fontWeight: "800", color: colors.primary },
  miniLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  sectionTitle: {
    marginTop: 20,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: colors.primaryDarker,
  },
  bars: { gap: 12, paddingBottom: 24 },
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
