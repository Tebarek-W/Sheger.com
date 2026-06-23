import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import {
  fetchSubscriptionPayments,
  fetchSubscriptionSummary,
  selectSubscriptionPlan,
} from "@/lib/api/subscription";
import { getErrorMessage } from "@/lib/errors";
import type { BillingInterval, SubscriptionPlan } from "@/lib/types/database";

const PAYMENT_METHODS = [
  { id: "telebirr", label: "Telebirr", desc: "Pay with mobile money", icon: "📱", color: "#e4f5e4" },
  { id: "cbe_birr", label: "CBE Birr", desc: "Commercial Bank of Ethiopia", icon: "🏦", color: "#e6f1fb" },
  { id: "cash", label: "Cash", desc: "Pay in person / bank deposit", icon: "💵", color: "#faeeda" },
  { id: "card", label: "Bank card", desc: "Visa / Mastercard", icon: "💳", color: "#eeedfe" },
];

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
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [method, setMethod] = useState("telebirr");
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

  const payMutation = useMutation({
    mutationFn: () =>
      selectSubscriptionPlan(
        business!.id,
        selectedPlanId!,
        interval,
        isPaidPlan ? method : "free",
      ),
    onSuccess: (result) => {
      submittingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["subscription-summary", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["subscription-payments", business?.id] });
      const msg =
        result.amount_etb > 0
          ? `Plan: ${result.plan.name}\nReference: ${result.reference_code}\nAmount: ${result.amount_etb} ETB`
          : `You are now on the ${result.plan.name} plan.`;
      Alert.alert("Subscription updated", msg);
    },
    onError: (error) => {
      Alert.alert("Could not update plan", getErrorMessage(error));
      submittingRef.current = false;
    },
  });

  if (!business) {
    return (
      <Screen>
        <Header title="Subscription & billing" />
        <Text style={styles.muted}>Register a business first.</Text>
      </Screen>
    );
  }

  if (isLoading || !summary) {
    return (
      <Screen>
        <Header title="Subscription & billing" />
        <Text style={styles.muted}>Loading…</Text>
      </Screen>
    );
  }

  const isLive = summary.is_marketplace_live;
  const periodEnd = summary.subscription?.current_period_end;
  const currentPlanName = summary.current_plan?.name ?? "None";

  const confirm = () => {
    if (!selectedPlanId || submittingRef.current || payMutation.isPending) return;
    submittingRef.current = true;
    payMutation.mutate();
  };

  return (
    <Screen scroll>
      <Header title="Subscription & billing" subtitle={business.name} />

      <View style={[styles.statusCard, isLive ? styles.statusLive : styles.statusExpired]}>
        <Text style={styles.statusTitle}>
          {isLive ? "Active on marketplace" : "Subscription inactive"}
        </Text>
        <Text style={styles.statusText}>
          {isLive
            ? `Plan: ${currentPlanName} · visible until ${formatDate(periodEnd)}`
            : "Choose a plan to appear in customer search and accept bookings."}
        </Text>
      </View>

      <View style={styles.usageCard}>
        <Text style={styles.sectionLabel}>Your usage</Text>
        <Text style={styles.usageLine}>
          Services: {summary.usage.active_services} / {summary.limits.max_services}
        </Text>
        <Text style={styles.usageLine}>
          Bookings this week: {summary.usage.weekly_bookings} / {summary.limits.max_bookings_per_week}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>Choose a plan</Text>
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
                <Text style={styles.planFeatured}>Featured in search results</Text>
              ) : null}
              <Text style={styles.planLimits}>
                {plan.max_services} services · {plan.max_bookings_per_week} bookings/week
              </Text>
              <Text style={styles.planPrice}>
                {Number(plan.monthly_fee_etb).toLocaleString()} ETB/mo ·{" "}
                {Number(plan.yearly_fee_etb).toLocaleString()} ETB/yr
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedPlan && selectedAmount > 0 ? (
        <>
          <Text style={styles.sectionLabel}>Billing interval</Text>
          <View style={styles.intervalRow}>
            <Pressable
              style={[styles.intervalCard, interval === "monthly" && styles.intervalActive]}
              onPress={() => setInterval("monthly")}
            >
              <Text style={styles.intervalTitle}>Monthly</Text>
              <Text style={styles.intervalPrice}>
                {Number(selectedPlan.monthly_fee_etb).toLocaleString()} ETB
              </Text>
            </Pressable>
            <Pressable
              style={[styles.intervalCard, interval === "yearly" && styles.intervalActive]}
              onPress={() => setInterval("yearly")}
            >
              <Text style={styles.intervalTitle}>Yearly</Text>
              <Text style={styles.intervalPrice}>
                {Number(selectedPlan.yearly_fee_etb).toLocaleString()} ETB
              </Text>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Payment method</Text>
          <View style={styles.methods}>
            {PAYMENT_METHODS.map((item) => {
              const active = method === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.method, active && styles.methodActive]}
                  onPress={() => setMethod(item.id)}
                >
                  <View style={[styles.methodIcon, { backgroundColor: item.color }]}>
                    <Text style={styles.methodEmoji}>{item.icon}</Text>
                  </View>
                  <View style={styles.methodText}>
                    <Text style={styles.methodName}>{item.label}</Text>
                    <Text style={styles.methodSub}>{item.desc}</Text>
                  </View>
                  <View style={[styles.radio, active && styles.radioOn]}>
                    {active ? <View style={styles.radioDot} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.mockNote}>
            Mock payment — no live gateway. Your selected method is recorded for admin review.
          </Text>
        </>
      ) : selectedPlan ? (
        <Text style={styles.mockNote}>
          The {selectedPlan.name} plan is free. Tap below to activate with no payment.
        </Text>
      ) : null}

      <View style={styles.summary}>
        <View style={styles.payRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>
            {selectedAmount > 0 ? `${selectedAmount.toLocaleString()} ETB` : "Free"}
          </Text>
        </View>
      </View>

      <Button
        title={selectedAmount > 0 ? "Confirm subscription" : "Activate plan"}
        onPress={confirm}
        loading={payMutation.isPending}
        disabled={!selectedPlanId}
      />

      {payments && payments.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.sectionLabel}>Payment history</Text>
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
  muted: { color: colors.textMuted, marginTop: 16 },
  statusCard: {
    marginTop: 16,
    borderRadius: radius.md,
    padding: 14,
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
  statusTitle: { fontSize: 14, fontWeight: "700", color: colors.primaryDarker },
  statusText: { fontSize: 13, color: colors.textMuted, lineHeight: 19 },
  usageCard: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  usageLine: { fontSize: 14, color: colors.text },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 24,
    marginBottom: 12,
  },
  plans: { gap: 10 },
  planCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
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
  intervalRow: { flexDirection: "row", gap: 10 },
  intervalCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
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
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: { fontSize: 14, fontWeight: "500", color: colors.text },
  totalValue: { fontSize: 16, fontWeight: "500", color: colors.primary },
  mockNote: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  methods: { gap: 10, marginBottom: 16 },
  method: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  methodActive: {
    borderColor: colors.primary,
    backgroundColor: colors.screenBg,
  },
  methodIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  methodEmoji: { fontSize: 18 },
  methodText: { flex: 1, gap: 2 },
  methodName: { fontSize: 14, fontWeight: "500", color: colors.text },
  methodSub: { fontSize: 11, color: colors.textSecondary },
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
  history: { marginTop: 28, paddingBottom: 24, gap: 10 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
  },
  historyMain: { flex: 1, gap: 2 },
  historyTitle: { fontSize: 14, fontWeight: "600", color: colors.text },
  historySub: { fontSize: 12, color: colors.textMuted },
  historyDate: { fontSize: 11, color: colors.textSecondary },
});
