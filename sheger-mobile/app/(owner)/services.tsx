import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { createService, fetchMyServices, updateService } from "@/lib/api/owner";
import { fetchSubscriptionSummary } from "@/lib/api/subscription";
import { isHealthFacilityCategory } from "@/lib/documents/license-validation";
import { getErrorMessage } from "@/lib/errors";
import {
  DURATION_MODEL_OPTIONS,
  formatServiceDuration,
  formatServicePrice,
  PRICING_MODEL_OPTIONS,
} from "@/lib/services/pricing";
import { parseOptionalNumber, validateCreateServiceInput } from "@/lib/services/validation";
import type { ServiceDurationModel, ServicePricingModel } from "@/lib/types/database";

function ModelPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <View style={styles.pickerBlock}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.pickerRow}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.value}
              style={[styles.pickerChip, active && styles.pickerChipActive]}
              onPress={() => onChange(option.value)}
            >
              <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.pickerHint}>
        {options.find((option) => option.value === value)?.hint}
      </Text>
    </View>
  );
}

export default function OwnerServicesScreen() {
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const categorySlug =
    business && "categories" in business
      ? (business.categories as { slug: string } | null)?.slug
      : null;
  const isHealthcare = isHealthFacilityCategory(categorySlug);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pricingModel, setPricingModel] = useState<ServicePricingModel>("fixed");
  const [durationModel, setDurationModel] = useState<ServiceDurationModel>("fixed");
  const [price, setPrice] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [duration, setDuration] = useState("30");
  const [blockMinutes, setBlockMinutes] = useState("30");
  const [defaultsApplied, setDefaultsApplied] = useState(false);

  useEffect(() => {
    if (!isHealthcare || defaultsApplied) return;
    setPricingModel("starting_from");
    setDurationModel("estimated");
    setBlockMinutes("45");
    setDefaultsApplied(true);
  }, [isHealthcare, defaultsApplied]);

  const { data: services, isLoading } = useQuery({
    queryKey: ["owner-services", business?.id],
    queryFn: () => fetchMyServices(business!.id),
    enabled: Boolean(business?.id),
  });

  const { data: subscriptionSummary } = useQuery({
    queryKey: ["subscription-summary", business?.id],
    queryFn: () => fetchSubscriptionSummary(business!.id),
    enabled: Boolean(business?.id),
  });

  const resetForm = () => {
    setName("");
    setDescription("");
    setPrice("");
    setPriceMin("");
    setPriceMax("");
    setDuration("30");
    setBlockMinutes(isHealthcare ? "45" : "30");
    if (!isHealthcare) {
      setPricingModel("fixed");
      setDurationModel("fixed");
    }
  };

  const buildInput = useMemo(() => {
    if (!business?.id) return null;
    return {
      businessId: business.id,
      name: name.trim(),
      description: description.trim() || undefined,
      pricingModel,
      durationModel,
      price:
        pricingModel === "fixed" || pricingModel === "starting_from"
          ? parseOptionalNumber(price)
          : null,
      priceMin:
        pricingModel === "range" || pricingModel === "variable"
          ? parseOptionalNumber(priceMin)
          : null,
      priceMax: pricingModel === "range" ? parseOptionalNumber(priceMax) : null,
      durationMinutes:
        durationModel === "flexible"
          ? parseOptionalNumber(blockMinutes) ?? 30
          : parseOptionalNumber(duration) ?? 30,
      schedulingBlockMinutes:
        durationModel === "fixed"
          ? parseOptionalNumber(duration)
          : parseOptionalNumber(blockMinutes),
    };
  }, [
    business?.id,
    name,
    description,
    pricingModel,
    durationModel,
    price,
    priceMin,
    priceMax,
    duration,
    blockMinutes,
  ]);

  const addMutation = useMutation({
    mutationFn: () => createService(buildInput!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-services", business?.id] });
      resetForm();
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
    if (!buildInput) return;
    const validationError = validateCreateServiceInput(buildInput);
    if (validationError) {
      Alert.alert("Missing fields", validationError);
      return;
    }
    if (
      subscriptionSummary &&
      subscriptionSummary.usage.active_services >= subscriptionSummary.limits.max_services
    ) {
      Alert.alert(
        "Service limit reached",
        `You can have at most ${subscriptionSummary.limits.max_services} active services. Deactivate one or renew your plan from Subscription & billing.`,
      );
      return;
    }
    addMutation.mutate();
  };

  const onToggle = (id: string, is_active: boolean) => {
    if (
      is_active &&
      subscriptionSummary &&
      subscriptionSummary.usage.active_services >= subscriptionSummary.limits.max_services
    ) {
      Alert.alert(
        "Service limit reached",
        `You can have at most ${subscriptionSummary.limits.max_services} active services.`,
      );
      return;
    }
    toggleMutation.mutate({ id, is_active });
  };

  const showPriceField = pricingModel === "fixed" || pricingModel === "starting_from";
  const showRangeFields = pricingModel === "range";
  const showGuidePrice = pricingModel === "variable";
  const showDurationField = durationModel === "fixed" || durationModel === "estimated";
  const showBlockField = durationModel === "estimated" || durationModel === "flexible";

  return (
    <Screen scroll>
      <Header title="Services & prices" subtitle="What customers can book" showBack />

      {isHealthcare ? (
        <Text style={styles.healthHint}>
          Consultations can use estimated time and starting-from pricing. Calendar block time
          reserves the slot; actual visit length may vary.
        </Text>
      ) : null}

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>Add service</Text>
        <Input label="Name" value={name} onChangeText={setName} placeholder="Haircut" />
        <Input label="Description" value={description} onChangeText={setDescription} />

        <ModelPicker
          label="Pricing"
          value={pricingModel}
          options={PRICING_MODEL_OPTIONS}
          onChange={setPricingModel}
        />
        <ModelPicker
          label="Duration"
          value={durationModel}
          options={DURATION_MODEL_OPTIONS}
          onChange={setDurationModel}
        />

        {showPriceField ? (
          <Input
            label={pricingModel === "starting_from" ? "Minimum price (ETB)" : "Price (ETB)"}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        ) : null}

        {showRangeFields ? (
          <View style={styles.row}>
            <View style={styles.half}>
              <Input
                label="Min price (ETB)"
                value={priceMin}
                onChangeText={setPriceMin}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.half}>
              <Input
                label="Max price (ETB)"
                value={priceMax}
                onChangeText={setPriceMax}
                keyboardType="numeric"
              />
            </View>
          </View>
        ) : null}

        {showGuidePrice ? (
          <Input
            label="Guide price (optional ETB)"
            value={priceMin}
            onChangeText={setPriceMin}
            keyboardType="numeric"
            placeholder="Optional minimum estimate"
          />
        ) : null}

        {showDurationField ? (
          <Input
            label={durationModel === "estimated" ? "Typical duration (min)" : "Duration (min)"}
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
          />
        ) : null}

        {showBlockField ? (
          <Input
            label="Calendar block (min)"
            value={blockMinutes}
            onChangeText={setBlockMinutes}
            keyboardType="numeric"
          />
        ) : null}

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
                {formatServicePrice(service)} · {formatServiceDuration(service)}
              </Text>
              {!service.is_active ? (
                <Text style={styles.inactive}>Inactive</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => onToggle(service.id, !service.is_active)}
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
  healthHint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    marginBottom: 12,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 12,
  },
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
  pickerBlock: { gap: 8 },
  pickerLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  pickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pickerChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  pickerChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  pickerChipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  pickerChipTextActive: { color: colors.primaryDarker },
  pickerHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
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
