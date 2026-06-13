import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { colors, radius } from "@/constants/theme";
import { fetchBusinessEmployees } from "@/lib/api/businesses";
import type { Employee } from "@/lib/types/database";

type BusinessStaffTabProps = {
  businessId: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function BusinessStaffTab({ businessId }: BusinessStaffTabProps) {
  const { data: employees, isLoading } = useQuery({
    queryKey: ["business-employees", businessId],
    queryFn: () => fetchBusinessEmployees(businessId),
  });

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!employees?.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>👥</Text>
        <Text style={styles.emptyTitle}>No staff listed</Text>
        <Text style={styles.emptyText}>This business has not added team members yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {employees.map((employee: Employee) => (
        <View key={employee.id} style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(employee.full_name)}</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{employee.full_name}</Text>
            {employee.role ? <Text style={styles.role}>{employee.role}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: 32, alignItems: "center" },
  empty: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyTitle: { fontSize: 15, fontWeight: "500", color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: "center" },
  list: { gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    padding: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "600", color: colors.primaryDark },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: "600", color: colors.text },
  role: { fontSize: 12, color: colors.textSecondary },
});
