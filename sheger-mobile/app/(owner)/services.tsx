import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { createService, fetchMyServices, updateService } from "@/lib/api/owner";
import { getErrorMessage } from "@/lib/errors";
import { useState } from "react";

export default function OwnerServicesScreen() {
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");

  const { data: services, isLoading } = useQuery({
    queryKey: ["owner-services", business?.id],
    queryFn: () => fetchMyServices(business!.id),
    enabled: Boolean(business?.id),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      createService({
        businessId: business!.id,
        name,
        description,
        price: Number(price),
        durationMinutes: Number(duration),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-services", business?.id] });
      setName("");
      setDescription("");
      setPrice("");
      setDuration("30");
    },
    onError: (e) => Alert.alert("Error", getErrorMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      updateService(id, { is_active }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["owner-services", business?.id] }),
  });

  const onAdd = () => {
    if (!name || !price || !duration) {
      Alert.alert("Missing fields", "Enter name, price, and duration.");
      return;
    }
    addMutation.mutate();
  };

  return (
    <Screen scroll>
      <Header title="Services & prices" subtitle="What customers can book" showBack />

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add service</Text>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Haircut" />
        <Input label="Description" value={description} onChangeText={setDescription} />
        <View style={styles.row}>
          <View style={styles.half}>
            <Input label="Price (ETB)" value={price} onChangeText={setPrice} keyboardType="numeric" />
          </View>
          <View style={styles.half}>
            <Input label="Duration (min)" value={duration} onChangeText={setDuration} keyboardType="numeric" />
          </View>
        </View>
        <Button title="Add service" onPress={onAdd} loading={addMutation.isPending} />
      </View>

      <Text style={styles.sectionTitle}>Your services</Text>
      {isLoading ? <Text style={styles.muted}>Loading...</Text> : null}
      <View style={styles.list}>
        {services?.map((service) => (
          <View key={service.id} style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{service.name}</Text>
              <Text style={styles.itemMeta}>
                {Number(service.price).toFixed(0)} ETB · {service.duration_minutes} min
              </Text>
              {!service.is_active ? (
                <Text style={styles.inactive}>Inactive</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() =>
                toggleMutation.mutate({ id: service.id, is_active: !service.is_active })
              }
            >
              <Text style={styles.toggle}>
                {service.is_active ? "Deactivate" : "Activate"}
              </Text>
            </Pressable>
          </View>
        ))}
        {!services?.length && !isLoading ? (
          <Text style={styles.muted}>No services yet. Add your first one above.</Text>
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
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
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
    gap: 12,
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  itemMeta: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  inactive: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  toggle: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  muted: { color: colors.textMuted },
});
