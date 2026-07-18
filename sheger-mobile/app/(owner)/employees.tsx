import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { createEmployee, fetchMyEmployees, updateEmployee } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";

export default function OwnerEmployeesScreen() {
  const { t } = useI18n();
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
    onError: (e) => Alert.alert(t("common.error"), getErrorMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateEmployee(id, { is_active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["owner-employees", business?.id] }),
  });

  return (
    <Screen scroll>
      <Header
        title={t("owner.screens.employees.title")}
        subtitle={t("owner.screens.employees.subtitle")}
        showBack
      />

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>{t("owner.screens.employees.addTitle")}</Text>
        <Input
          label={t("owner.screens.employees.fullName")}
          value={fullName}
          onChangeText={setFullName}
          placeholder={t("owner.screens.employees.fullNamePlaceholder")}
        />
        <Input
          label={t("owner.screens.employees.roleOptional")}
          value={role}
          onChangeText={setRole}
          placeholder={t("owner.screens.employees.rolePlaceholder")}
        />
        <Button
          title={t("owner.screens.employees.addButton")}
          onPress={() => {
            if (!fullName) {
              Alert.alert(
                t("owner.screens.employees.missingNameTitle"),
                t("owner.screens.employees.missingNameMessage"),
              );
              return;
            }
            addMutation.mutate();
          }}
          loading={addMutation.isPending}
        />
      </View>

      <Text style={styles.sectionTitle}>{t("owner.screens.employees.yourTeam")}</Text>
      <View style={styles.list}>
        {employees?.map((emp) => (
          <View key={emp.id} style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{emp.full_name}</Text>
              {emp.role ? <Text style={styles.itemMeta}>{emp.role}</Text> : null}
              {!emp.is_active ? (
                <Text style={styles.inactive}>{t("owner.screens.employees.inactive")}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => toggleMutation.mutate({ id: emp.id, is_active: !emp.is_active })}
            >
              <Text style={styles.toggle}>
                {emp.is_active
                  ? t("owner.screens.employees.deactivate")
                  : t("owner.screens.employees.activate")}
              </Text>
            </Pressable>
          </View>
        ))}
        {!employees?.length ? (
          <Text style={styles.muted}>{t("owner.screens.employees.empty")}</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: ownerLayout.cardPadding,
    gap: ownerLayout.cardGap,
    marginBottom: ownerLayout.sectionGap,
    ...shadows.sm,
  },
  addTitle: { ...typography.h3, color: colors.primaryDarker },
  sectionTitle: {
    ...typography.h2,
    color: colors.primaryDarker,
    marginBottom: ownerLayout.sectionTitleBottom,
  },
  list: { gap: ownerLayout.listGap, paddingBottom: ownerLayout.bottomPadding },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: ownerLayout.cardPadding,
    ...shadows.sm,
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  itemMeta: { fontSize: 14, color: colors.textMuted },
  inactive: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  toggle: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  muted: { color: colors.textMuted },
});
