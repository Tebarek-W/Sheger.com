import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
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
  const { t } = useI18n();
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

  const pricingOptions = useMemo(
    () =>
      PRICING_MODEL_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(`owner.screens.services.pricingModels.${opt.value}.label`),
        hint: t(`owner.screens.services.pricingModels.${opt.value}.hint`),
      })),
    [t],
  );

  const durationOptions = useMemo(
    () =>
      DURATION_MODEL_OPTIONS.map((opt) => ({
        value: opt.value,
        label: t(`owner.screens.services.durationModels.${opt.value}.label`),
        hint: t(`owner.screens.services.durationModels.${opt.value}.hint`),
      })),
    [t],
  );

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
    onError: (e) => Alert.alert(t("common.error"), getErrorMessage(e)),
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
      Alert.alert(t("owner.screens.services.missingFieldsTitle"), validationError);
      return;
    }
    if (
      subscriptionSummary &&
      subscriptionSummary.usage.active_services >= subscriptionSummary.limits.max_services
    ) {
      Alert.alert(
        t("owner.screens.services.limitTitle"),
        t("owner.screens.services.limitActivateMessage", {
          max: subscriptionSummary.limits.max_services,
        }),
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
        t("owner.screens.services.limitTitle"),
        t("owner.screens.services.limitMessage", {
          max: subscriptionSummary.limits.max_services,
        }),
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
      <Header
        title={t("owner.screens.services.title")}
        subtitle={t("owner.screens.services.subtitle")}
        showBack
      />

      {isHealthcare ? (
        <Text style={styles.healthHint}>{t("owner.screens.services.healthHint")}</Text>
      ) : null}

      <View style={styles.addCard}>
        <Text style={styles.addTitle}>{t("owner.screens.services.addTitle")}</Text>
        <Input
          label={t("owner.screens.services.name")}
          value={name}
          onChangeText={setName}
          placeholder={t("owner.screens.services.namePlaceholder")}
        />
        <Input
          label={t("owner.screens.services.description")}
          value={description}
          onChangeText={setDescription}
        />

        <ModelPicker
          label={t("owner.screens.services.pricing")}
          value={pricingModel}
          options={pricingOptions}
          onChange={setPricingModel}
        />
        <ModelPicker
          label={t("owner.screens.services.duration")}
          value={durationModel}
          options={durationOptions}
          onChange={setDurationModel}
        />

        {showPriceField ? (
          <Input
            label={
              pricingModel === "starting_from"
                ? t("owner.screens.services.minPriceEtb")
                : t("owner.screens.services.priceEtb")
            }
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
          />
        ) : null}

        {showRangeFields ? (
          <View style={styles.row}>
            <View style={styles.half}>
              <Input
                label={t("owner.screens.services.minPriceLabel")}
                value={priceMin}
                onChangeText={setPriceMin}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.half}>
              <Input
                label={t("owner.screens.services.maxPriceLabel")}
                value={priceMax}
                onChangeText={setPriceMax}
                keyboardType="numeric"
              />
            </View>
          </View>
        ) : null}

        {showGuidePrice ? (
          <Input
            label={t("owner.screens.services.guidePrice")}
            value={priceMin}
            onChangeText={setPriceMin}
            keyboardType="numeric"
            placeholder={t("owner.screens.services.guidePricePlaceholder")}
          />
        ) : null}

        {showDurationField ? (
          <Input
            label={
              durationModel === "estimated"
                ? t("owner.screens.services.typicalDuration")
                : t("owner.screens.services.durationMin")
            }
            value={duration}
            onChangeText={setDuration}
            keyboardType="numeric"
          />
        ) : null}

        {showBlockField ? (
          <Input
            label={t("owner.screens.services.calendarBlock")}
            value={blockMinutes}
            onChangeText={setBlockMinutes}
            keyboardType="numeric"
          />
        ) : null}

        <Button
          title={t("owner.screens.services.addButton")}
          onPress={onAdd}
          loading={addMutation.isPending}
        />
      </View>

      <Text style={styles.sectionTitle}>{t("owner.screens.services.yourServices")}</Text>
      {isLoading ? <Text style={styles.muted}>{t("common.loading")}</Text> : null}
      <View style={styles.list}>
        {services?.map((service) => (
          <View key={service.id} style={styles.item}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{service.name}</Text>
              <Text style={styles.itemMeta}>
                {formatServicePrice(service, t)} · {formatServiceDuration(service, t)}
              </Text>
              {!service.is_active ? (
                <Text style={styles.inactive}>{t("owner.screens.services.inactive")}</Text>
              ) : null}
            </View>
            <Pressable onPress={() => onToggle(service.id, !service.is_active)}>
              <Text style={styles.toggle}>
                {service.is_active
                  ? t("owner.screens.services.deactivate")
                  : t("owner.screens.services.activate")}
              </Text>
            </Pressable>
          </View>
        ))}
        {!services?.length && !isLoading ? (
          <Text style={styles.muted}>{t("owner.screens.services.empty")}</Text>
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
    marginBottom: ownerLayout.sectionGap,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: ownerLayout.cardPadding,
  },
  addCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: ownerLayout.cardPadding,
    gap: ownerLayout.cardGap,
    marginBottom: ownerLayout.sectionGap,
    ...shadows.sm,
  },
  addTitle: { ...typography.h3, color: colors.primaryDarker },
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
    ...shadows.sm,
  },
  pickerChipText: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },
  pickerChipTextActive: { color: colors.primaryDarker },
  pickerHint: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  row: { flexDirection: "row", gap: ownerLayout.cardGap },
  half: { flex: 1 },
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
    gap: ownerLayout.cardGap,
    ...shadows.sm,
  },
  itemInfo: { flex: 1, gap: 4 },
  itemName: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  itemMeta: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  inactive: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  toggle: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  muted: { color: colors.textMuted },
});
