import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { createEmployee, fetchMyEmployees, updateEmployee } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";

export default function OwnerEmployeesScreen() {
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");

  const { data: employees } = useQuery({
    queryKey: ["owner-employees", business?.id],
    queryFn: () => fetchMyEmployees(business!.id),
    enabled: Boolean(business?.id),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createEmployee({
        businessId: business!.id,
        fullName,
        role: role || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-employees", business?.id] });
      setFullName("");
      setRole("");
    },
    onError: (e) => Alert.alert("Error", getErrorMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateEmployee(id, { is_active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["owner-employees", business?.id] }),
  });

  return (
    <Screen scroll>
      <Header title="Employees" subtitle="Staff who can take bookings" showBack />

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add employee</Text>
        <Input label="Full name" value={fullName} onChangeText={setFullName} placeholder="Abebe Kebede" />
        <Input label="Role (optional)" value={role} onChangeText={setRole} placeholder="Barber, Stylist..." />
        <Button
          title="Add employee"
          onPress={() => {
            if (!fullName) {
              Alert.alert("Missing name", "Enter the employee's name.");
              return;
            }
            addMutation.mutate();
          }}
          loading={addMutation.isPending}
        />
      </View>

      <Text style={styles.sectionTitle}>Your team</Text>
      <View style={styles.list}>
        {employees?.map((emp) => (
          <View key={emp.id} style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{emp.full_name}</Text>
              {emp.role ? <Text style={styles.itemMeta}>{emp.role}</Text> : null}
              {!emp.is_active ? <Text style={styles.inactive}>Inactive</Text> : null}
            </View>
            <Pressable
              onPress={() => toggleMutation.mutate({ id: emp.id, is_active: !emp.is_active })}
            >
              <Text style={styles.toggle}>{emp.is_active ? "Deactivate" : "Activate"}</Text>
            </Pressable>
          </View>
        ))}
        {!employees?.length ? (
          <Text style={styles.muted}>No employees yet.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  addTitle: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryDarker, marginBottom: 12 },
  list: { gap: 10, paddingBottom: 24 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  itemMeta: { fontSize: 14, color: colors.textMuted },
  inactive: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  toggle: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  muted: { color: colors.textMuted },
});
