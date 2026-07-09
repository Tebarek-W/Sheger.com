import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { DualDateTime } from "@/components/ui/DualDateTime";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { createBooking } from "@/lib/api/bookings";
import { checkChapaBookingEligibility } from "@/lib/api/chapa-eligibility";
import { initializeChapaBookingPayment } from "@/lib/api/chapa";
import { DEFAULT_CANCELLATION_HOURS, getCancellationPolicyText } from "@/lib/booking/cancellation";
import {
  bookingPaymentStatusForMethod,
  PAYMENT_METHOD_CHAPA,
  PAYMENT_METHOD_PAY_AT_VISIT,
} from "@/lib/payment/methods";
import { getErrorMessage } from "@/lib/errors";
import {
  formatServiceDuration,
  getCheckoutPriceLabel,
  getOnlineChargeableAmount,
} from "@/lib/services/pricing";
import { fetchAvailableSlotsForDate, slotInstantKey } from "@/lib/api/slots";
import { useBookingStore } from "@/stores/bookingStore";

export default function PaymentScreen() {
  return (
    <RequireAuth>
      <PaymentScreenContent />
    </RequireAuth>
  );
}

function PaymentScreenContent() {
  const { user } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const business = useBookingStore((s) => s.business);
  const service = useBookingStore((s) => s.service);
  const scheduledAt = useBookingStore((s) => s.scheduledAt);
  const employeeId = useBookingStore((s) => s.employeeId);
  const setPaymentMethod = useBookingStore((s) => s.setPaymentMethod);
  const setBookingId = useBookingStore((s) => s.setBookingId);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const checkoutPrice = service ? getCheckoutPriceLabel(service) : null;
  const chargeableAmount = service ? getOnlineChargeableAmount(service) : null;
  const requiresOnlinePay = chargeableAmount != null && chargeableAmount > 0;
  const isDeposit = checkoutPrice?.isDeposit ?? false;

  const { data: chapaEligibility, isLoading: chapaEligibilityLoading } = useQuery({
    queryKey: ["chapa-eligibility", business?.id],
    queryFn: () => checkChapaBookingEligibility(business!.id),
    enabled: Boolean(business?.id && requiresOnlinePay),
  });

  const onlinePayAvailable =
    requiresOnlinePay && (chapaEligibility?.eligible ?? false);
  const onlineBlocked =
    requiresOnlinePay && !chapaEligibilityLoading && !onlinePayAvailable;
  /** Variable with no min: book without Chapa (pay at visit). */
  const payAtVisitOnly = !requiresOnlinePay;
  const canConfirm = onlinePayAvailable || payAtVisitOnly;

  const confirm = async () => {
    if (!user || !business || !service || !scheduledAt) return;
    if (!canConfirm) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      const slotDate = new Date(scheduledAt);
      const slots = await fetchAvailableSlotsForDate(business.id, slotDate, employeeId);
      const selectedSlot = slots.find(
        (slot) => slotInstantKey(slot.scheduledAt) === slotInstantKey(scheduledAt),
      );
      if (!selectedSlot || selectedSlot.isFull) {
        Alert.alert(t("payment.bookingFailed"), t("payment.slotUnavailable"));
        submittingRef.current = false;
        return;
      }

      if (onlinePayAvailable) {
        setPaymentMethod(PAYMENT_METHOD_CHAPA);
        const result = await initializeChapaBookingPayment({
          businessId: business.id,
          serviceId: service.id,
          employeeId,
          scheduledAt,
        });

        submittingRef.current = false;
        router.push({
          pathname: "/(app)/payment/checkout",
          params: { txRef: result.tx_ref, checkoutUrl: result.checkout_url },
        });
        return;
      }

      // No chargeable minimum (e.g. variable with no price_min): book now, pay at visit.
      setPaymentMethod(PAYMENT_METHOD_PAY_AT_VISIT);
      const booking = await createBooking({
        customerId: user.id,
        businessId: business.id,
        serviceId: service.id,
        employeeId,
        scheduledAt,
        durationMinutes: service.duration_minutes,
        paymentMethod: PAYMENT_METHOD_PAY_AT_VISIT,
        paymentStatus: bookingPaymentStatusForMethod(PAYMENT_METHOD_PAY_AT_VISIT),
      });

      setBookingId(booking.id);
      queryClient.invalidateQueries({ queryKey: ["available-slots", business.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });

      router.replace("/(app)/confirmation");
    } catch (error) {
      Alert.alert(
        onlinePayAvailable ? t("payment.paymentUnavailable") : t("payment.bookingFailed"),
        getErrorMessage(error),
      );
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (!business || !service || !scheduledAt) {
    return (
      <Screen padded={false}>
        <View style={styles.pad}>
          <BookingHeader title={t("payment.title")} />
          <Text style={styles.muted}>{t("payment.incomplete")}</Text>
        </View>
      </Screen>
    );
  }

  const price = checkoutPrice?.primary ?? "—";
  const dueNowLabel =
    chargeableAmount != null ? `${Math.round(chargeableAmount)} ETB` : null;

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        <BookingHeader title={t("payment.title")} />

        <View style={styles.summary}>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>{t("payment.service")}</Text>
            <Text style={styles.payValue}>{service.name}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>{t("payment.business")}</Text>
            <Text style={styles.payValue}>{business.name}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>{t("payment.duration")}</Text>
            <Text style={styles.payValue}>{formatServiceDuration(service)}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.payLabel}>{t("payment.dateTime")}</Text>
            <DualDateTime iso={scheduledAt} compact />
          </View>
          <View style={styles.divider} />
          <View style={styles.payRow}>
            <Text style={styles.totalLabel}>
              {checkoutPrice?.showExactTotal ? t("payment.total") : t("payment.price")}
            </Text>
            <Text style={styles.totalValue}>{price}</Text>
          </View>
          {dueNowLabel && requiresOnlinePay ? (
            <View style={styles.payRow}>
              <Text style={styles.totalLabel}>{t("payment.dueNow")}</Text>
              <Text style={styles.totalValue}>{dueNowLabel}</Text>
            </View>
          ) : null}
          {checkoutPrice?.secondary ? (
            <Text style={styles.priceNote}>{checkoutPrice.secondary}</Text>
          ) : null}
        </View>

        {isDeposit && dueNowLabel ? (
          <View style={styles.depositBox}>
            <Text style={styles.depositTitle}>{t("payment.depositNoticeTitle")}</Text>
            <Text style={styles.depositText}>
              {t("payment.depositNotice", { amount: dueNowLabel })}
            </Text>
          </View>
        ) : null}

        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>{t("payment.cancellationPolicy")}</Text>
          <Text style={styles.policyText}>
            {getCancellationPolicyText(
              business.cancellation_hours ?? DEFAULT_CANCELLATION_HOURS,
            )}
          </Text>
        </View>

        {onlinePayAvailable ? (
          <>
            <Text style={styles.sectionLabel}>{t("payment.methodSection")}</Text>
            <View style={styles.methods}>
              <Pressable style={[styles.method, styles.methodActive]}>
                <View style={[styles.methodIcon, { backgroundColor: "#e4f5e4" }]}>
                  <Text style={styles.methodEmoji}>💳</Text>
                </View>
                <View style={styles.methodText}>
                  <Text style={styles.methodName}>{t("payment.chapa")}</Text>
                  <Text style={styles.methodSub}>{t("payment.chapaDesc")}</Text>
                </View>
                <View style={[styles.radio, styles.radioOn]}>
                  <View style={styles.radioDot} />
                </View>
              </Pressable>
            </View>
            <Text style={styles.chapaNote}>
              {isDeposit ? t("payment.chapaDepositNote") : t("payment.chapaNote")}
            </Text>
          </>
        ) : null}

        {payAtVisitOnly ? (
          <Text style={styles.chapaNote}>{t("payment.flexiblePayNote")}</Text>
        ) : null}

        {onlineBlocked ? (
          <Text style={styles.blockedNote}>
            {t("payment.chapaPayoutNotConfigured")}
          </Text>
        ) : null}

        <Button
          title={
            onlinePayAvailable
              ? t("payment.continueToPayment")
              : t("payment.confirmBooking")
          }
          onPress={confirm}
          loading={loading}
          disabled={!canConfirm || (requiresOnlinePay && chapaEligibilityLoading)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 16, paddingBottom: 24 },
  summary: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 20,
    marginTop: 16,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  dateBlock: {
    paddingVertical: 6,
    gap: 8,
  },
  payLabel: { fontSize: 13, color: colors.textSecondary, flex: 1 },
  payValue: { fontSize: 13, fontWeight: "500", color: colors.text, textAlign: "right", flex: 1 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalLabel: { fontSize: 14, fontWeight: "500", color: colors.text },
  totalValue: { fontSize: 16, fontWeight: "500", color: colors.primary },
  priceNote: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },
  depositBox: {
    backgroundColor: "#fff8e8",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#f0d9a0",
    padding: 12,
    marginBottom: 16,
    gap: 6,
  },
  depositTitle: { fontSize: 13, fontWeight: "700", color: colors.text },
  depositText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  policyBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: 20,
    gap: 4,
  },
  policyTitle: { fontSize: 12, fontWeight: "600", color: colors.primaryDark },
  policyText: { fontSize: 12, color: colors.primaryDark, lineHeight: 17 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 12,
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
  chapaNote: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 16,
  },
  blockedNote: {
    fontSize: 12,
    color: colors.error,
    lineHeight: 18,
    marginBottom: 16,
  },
  muted: { color: colors.textMuted },
});
