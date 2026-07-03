import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import {
  fetchSubscriptionPayments,
  fetchSubscriptionSummary,
  selectSubscriptionPlan,
} from "@/lib/api/subscription";
import { getErrorMessage } from "@/lib/errors";
import type { BillingInterval, SubscriptionPlan } from "@/lib/types/database";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ET", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function planPrice(plan: SubscriptionPlan, interval: BillingInterval) {
  return interval === "yearly" ? Number(plan.yearly_fee_etb) : Number(plan.monthly_fee_etb);
}

export default function OwnerBillingScreen() {
  const { t } = useI18n();
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const submittingRef = useRef(false);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["subscription-summary", business?.id],
    queryFn: () => fetchSubscriptionSummary(business!.id),
    enabled: Boolean(business?.id),
  });

  const { data: payments } = useQuery({
    queryKey: ["subscription-payments", business?.id],
    queryFn: () => fetchSubscriptionPayments(business!.id),
    enabled: Boolean(business?.id),
  });

  const plans = summary?.plans ?? [];

  useEffect(() => {
    if (!selectedPlanId && plans.length > 0) {
      const current = summary?.current_plan?.id ?? summary?.subscription?.plan_id;
      setSelectedPlanId(current ?? plans[0].id);
    }
  }, [plans, selectedPlanId, summary?.current_plan?.id, summary?.subscription?.plan_id]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  );

  const selectedAmount = selectedPlan ? planPrice(selectedPlan, interval) : 0;
  const isPaidPlan = selectedAmount > 0;

  const activateFreeMutation = useMutation({
    mutationFn: () =>
      selectSubscriptionPlan(business!.id, selectedPlanId!, interval, "free"),
    onSuccess: (result) => {
      submittingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["subscription-summary", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["subscription-payments", business?.id] });
      Alert.alert(
        t("owner.screens.billing.updatedTitle"),
        t("owner.screens.billing.updatedMessage", { plan: result.plan.name }),
      );
    },
    onError: (error) => {
      Alert.alert(t("owner.screens.billing.updateFailedTitle"), getErrorMessage(error));
      submittingRef.current = false;
    },
  });

  if (!business) {
    return (
      <Screen>
        <Header title={t("owner.screens.billing.title")} />
        <Text style={styles.muted}>{t("owner.screens.billing.registerFirst")}</Text>
      </Screen>
    );
  }

  if (isLoading || !summary) {
    return (
      <Screen>
        <Header title={t("owner.screens.billing.title")} />
        <Text style={styles.muted}>{t("common.loading")}</Text>
      </Screen>
    );
  }

  const isLive = summary.is_marketplace_live;
  const periodEnd = summary.subscription?.current_period_end;
  const graceEndsAt = summary.subscription?.grace_ends_at;
  const isGracePeriod = summary.subscription?.status === "past_due" && Boolean(graceEndsAt);
  const currentPlanName = summary.current_plan?.name ?? t("common.none");

  const confirm = () => {
    if (!selectedPlanId || submittingRef.current || activateFreeMutation.isPending) return;

    if (isPaidPlan) {
      router.push({
        pathname: "/(owner)/billing/checkout",
        params: {
          businessId: business.id,
          planId: selectedPlanId,
          interval,
          planName: selectedPlan?.name ?? "",
        },
      });
      return;
    }

    submittingRef.current = true;
    activateFreeMutation.mutate();
  };

  return (
    <Screen scroll>
      <Header title={t("owner.screens.billing.title")} subtitle={business.name} />

      <View style={[styles.statusCard, isLive ? styles.statusLive : styles.statusExpired]}>
        <Text style={styles.statusTitle}>
          {isLive ? t("owner.screens.billing.activeTitle") : t("owner.screens.billing.inactiveTitle")}
        </Text>
        <Text style={styles.statusText}>
          {isLive
            ? t("owner.screens.billing.activeText", {
                plan: currentPlanName,
                date: formatDate(isGracePeriod ? graceEndsAt : periodEnd),
              })
            : t("owner.screens.billing.inactiveText")}
        </Text>
      </View>

      {isGracePeriod ? (
        <View style={styles.graceCard}>
          <Text style={styles.graceTitle}>{t("owner.screens.billing.graceTitle")}</Text>
          <Text style={styles.graceText}>
            {t("owner.screens.billing.graceText", { date: formatDate(graceEndsAt) })}
          </Text>
        </View>
      ) : null}

      <View style={styles.usageCard}>
        <Text style={styles.sectionLabel}>{t("owner.screens.billing.usage")}</Text>
        <Text style={styles.usageLine}>
          {t("owner.screens.billing.servicesUsage", {
            used: summary.usage.active_services,
            max: summary.limits.max_services,
          })}
        </Text>
        <Text style={styles.usageLine}>
          {t("owner.screens.billing.bookingsUsage", {
            used: summary.usage.weekly_bookings,
            max: summary.limits.max_bookings_per_week,
          })}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>{t("owner.screens.billing.choosePlan")}</Text>
      <View style={styles.plans}>
        {plans.map((plan) => {
          const active = plan.id === selectedPlanId;
          return (
            <Pressable
              key={plan.id}
              style={[styles.planCard, active && styles.planCardActive]}
              onPress={() => setSelectedPlanId(plan.id)}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={[styles.radio, active && styles.radioOn]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </View>
              {plan.description ? (
                <Text style={styles.planDesc}>{plan.description}</Text>
              ) : null}
              {plan.is_featured_in_search ? (
                <Text style={styles.planFeatured}>{t("owner.screens.billing.featuredInSearch")}</Text>
              ) : null}
              <Text style={styles.planLimits}>
                {t("owner.screens.billing.planLimits", {
                  services: plan.max_services,
                  bookings: plan.max_bookings_per_week,
                })}
              </Text>
              <Text style={styles.planPrice}>
                {t("owner.screens.billing.planPrice", {
                  monthly: Number(plan.monthly_fee_etb).toLocaleString(),
                  yearly: Number(plan.yearly_fee_etb).toLocaleString(),
                })}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedPlan && selectedAmount > 0 ? (
        <>
          <Text style={styles.sectionLabel}>{t("owner.screens.billing.billingInterval")}</Text>
          <View style={styles.intervalRow}>
            <Pressable
              style={[styles.intervalCard, interval === "monthly" && styles.intervalActive]}
              onPress={() => setInterval("monthly")}
            >
              <Text style={styles.intervalTitle}>{t("owner.screens.billing.monthly")}</Text>
              <Text style={styles.intervalPrice}>
                {Number(selectedPlan.monthly_fee_etb).toLocaleString()} ETB
              </Text>
            </Pressable>
            <Pressable
              style={[styles.intervalCard, interval === "yearly" && styles.intervalActive]}
              onPress={() => setInterval("yearly")}
            >
              <Text style={styles.intervalTitle}>{t("owner.screens.billing.yearly")}</Text>
              <Text style={styles.intervalPrice}>
                {Number(selectedPlan.yearly_fee_etb).toLocaleString()} ETB
              </Text>
            </Pressable>
          </View>

          <Text style={styles.chapaNote}>{t("owner.screens.billing.chapaNotePaid")}</Text>
        </>
      ) : selectedPlan ? (
        <Text style={styles.chapaNote}>
          {t("owner.screens.billing.chapaNoteFree", { plan: selectedPlan.name })}
        </Text>
      ) : null}

      <View style={styles.summary}>
        <View style={styles.payRow}>
          <Text style={styles.totalLabel}>{t("owner.screens.billing.total")}</Text>
          <Text style={styles.totalValue}>
            {selectedAmount > 0 ? `${selectedAmount.toLocaleString()} ETB` : t("common.free")}
          </Text>
        </View>
      </View>

      <Button
        title={
          isPaidPlan
            ? t("owner.screens.billing.continueToPayment")
            : t("owner.screens.billing.activatePlan")
        }
        onPress={confirm}
        loading={activateFreeMutation.isPending}
        disabled={!selectedPlanId}
      />

      {payments && payments.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.sectionLabel}>{t("owner.screens.billing.paymentHistory")}</Text>
          {payments.map((payment) => (
            <View key={payment.id} style={styles.historyRow}>
              <View style={styles.historyMain}>
                <Text style={styles.historyTitle}>
                  {Number(payment.amount_etb).toLocaleString()} ETB · {payment.billing_interval}
                </Text>
                <Text style={styles.historySub}>
                  {payment.payment_method} · {payment.reference_code}
                </Text>
              </View>
              <Text style={styles.historyDate}>{formatDate(payment.created_at)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  muted: { color: colors.textMuted, marginTop: ownerLayout.blockGap },
  statusCard: {
    marginTop: ownerLayout.blockGap,
    borderRadius: radius.md,
    padding: ownerLayout.cardPadding,
    borderWidth: 1,
    gap: 4,
  },
  statusLive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.border,
  },
  statusExpired: {
    backgroundColor: colors.errorBg,
    borderColor: "#fecaca",
  },
  graceCard: {
    marginTop: ownerLayout.blockGap,
    borderRadius: radius.md,
    padding: ownerLayout.cardPadding,
    borderWidth: 1,
    borderColor: "#fde68a",
    backgroundColor: "#fffbeb",
    gap: 4,
  },
  graceTitle: { fontSize: 14, fontWeight: "700", color: "#854f0b" },
  graceText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  statusTitle: { fontSize: 14, fontWeight: "700", color: colors.primaryDarker },
  statusText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  usageCard: {
    marginTop: ownerLayout.blockGap,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: ownerLayout.cardPadding,
    gap: 6,
  },
  usageLine: { fontSize: 14, color: colors.text },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: ownerLayout.sectionGap,
    marginBottom: ownerLayout.sectionTitleBottom,
  },
  plans: { gap: ownerLayout.listGap },
  planCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: ownerLayout.cardPadding,
    gap: 6,
  },
  planCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.screenBg,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planName: { fontSize: 16, fontWeight: "700", color: colors.text },
  planDesc: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  planFeatured: { fontSize: 12, fontWeight: "600", color: "#854f0b" },
  planLimits: { fontSize: 12, color: colors.textSecondary },
  planPrice: { fontSize: 14, fontWeight: "600", color: colors.primary },
  intervalRow: { flexDirection: "row", gap: ownerLayout.listGap },
  intervalCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: ownerLayout.cardPadding,
    gap: 4,
  },
  intervalActive: {
    borderColor: colors.primary,
    backgroundColor: colors.screenBg,
  },
  intervalTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  intervalPrice: { fontSize: 18, fontWeight: "800", color: colors.primary },
  summary: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.lg,
    padding: ownerLayout.cardPadding,
    marginTop: ownerLayout.sectionGap - 4,
    marginBottom: ownerLayout.blockGap / 2,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 14, fontWeight: "500", color: colors.text },
  totalValue: { fontSize: 16, fontWeight: "500", color: colors.primary },
  chapaNote: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  history: { marginTop: ownerLayout.sectionGap + 4, paddingBottom: ownerLayout.bottomPadding, gap: ownerLayout.listGap },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ownerLayout.cardGap,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: ownerLayout.cardPadding,
  },
  historyMain: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  historySub: { fontSize: 12, color: colors.textMuted },
  historyDate: { fontSize: 11, color: colors.textSecondary },
});
