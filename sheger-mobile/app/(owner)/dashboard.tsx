import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { MenuCard } from "@/components/owner/MenuCard";
import { StatusBadge } from "@/components/owner/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchOwnerStats } from "@/lib/api/owner";

export default function OwnerDashboardScreen() {
  const { profile, signOut } = useAuth();
  const { business, isLoading } = useOwnerBusiness();

  const { data: stats } = useQuery({
    queryKey: ["owner-stats", business?.id],
    queryFn: () => fetchOwnerStats(business!.id),
    enabled: Boolean(business?.id),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator size="large" color={colors.primary} />
      </Screen>
    );
  }

  if (!business) {
    return (
      <Screen scroll>
        <View style={styles.topRow}>
          <Header
            title="Business Owner"
            subtitle={`Hello, ${profile?.full_name?.split(" ")[0] || "there"}`}
          />
          <Pressable onPress={signOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>

        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Register your business</Text>
          <Text style={styles.emptyText}>
            Add your salon, barbershop, clinic, or studio. After admin approval,
            customers can find and book you on Sheger.
          </Text>
          <Button title="Register Business" onPress={() => router.push("/(owner)/register")} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <Header
          title={business.name}
          subtitle="Manage your business on Sheger"
        />
        <Pressable onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </Pressable>
      </View>

      <StatusBadge status={business.status} />

      {business.status === "pending" ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Your business is awaiting admin approval. You can still set up
            services, staff, and hours while you wait.
          </Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.pendingBookings ?? 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats?.completedBookings ?? 0}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {(stats?.last30DaysRevenue ?? 0).toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>ETB (30d)</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Manage</Text>
      <View style={styles.menu}>
        <MenuCard
          icon="🏪"
          title="Business profile"
          subtitle="Edit name, address, contact"
          onPress={() => router.push("/(owner)/business")}
        />
        <MenuCard
          icon="✂️"
          title="Services & prices"
          subtitle="Add and update your offerings"
          onPress={() => router.push("/(owner)/services")}
        />
        <MenuCard
          icon="👥"
          title="Employees"
          subtitle="Manage your team"
          onPress={() => router.push("/(owner)/employees")}
        />
        <MenuCard
          icon="🕐"
          title="Working hours"
          subtitle="Set weekly availability"
          onPress={() => router.push("/(owner)/hours")}
        />
        <MenuCard
          icon="📅"
          title="Bookings"
          subtitle="Confirm, cancel, or complete"
          onPress={() => router.push("/(owner)/bookings")}
        />
        <MenuCard
          icon="📊"
          title="Income & reports"
          subtitle="Revenue and booking stats"
          onPress={() => router.push("/(owner)/reports")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  signOut: { color: colors.primary, fontWeight: "600", fontSize: 14, marginTop: 8 },
  emptyCard: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 24,
    gap: 12,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700", color: colors.primaryDarker },
  emptyText: { fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  notice: {
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeText: { color: colors.primaryDarker, fontSize: 14, lineHeight: 20 },
  statsRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.primaryDarker },
  statLabel: { fontSize: 11, color: colors.textMuted, fontWeight: "600" },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "700",
    color: colors.primaryDarker,
  },
  menu: { gap: 10, paddingBottom: 24 },
});
