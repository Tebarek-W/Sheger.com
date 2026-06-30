import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
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
import { DEFAULT_CANCELLATION_HOURS, getCancellationPolicyText } from "@/lib/booking/cancellation";
import {
  bookingPaymentStatusForMethod,
  isChapaOnlineMethod,
  PAYMENT_METHOD_CASH,
  PAYMENT_METHOD_CHAPA,
  type CustomerPaymentMethod,
} from "@/lib/payment/methods";
import { getErrorMessage } from "@/lib/errors";
import {
  formatServiceDuration,
  getCheckoutPriceLabel,
} from "@/lib/services/pricing";
import { useBookingStore } from "@/stores/bookingStore";

const PAYMENT_OPTIONS = [
  {
    id: PAYMENT_METHOD_CHAPA,
    labelKey: "payment.chapa" as const,
    descKey: "payment.chapaDesc" as const,
    icon: "💳",
    color: "#e4f5e4",
  },
  {
    id: PAYMENT_METHOD_CASH,
    labelKey: "payment.cash" as const,
    descKey: "payment.cashDesc" as const,
    icon: "💵",
    color: "#faeeda",
  },
];

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
  const setPaymentMethod = useBookingStore((s) => s.setPaymentMethod);
  const setBookingId = useBookingStore((s) => s.setBookingId);
  const [method, setMethod] = useState<CustomerPaymentMethod>(PAYMENT_METHOD_CHAPA);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const checkoutPrice = service ? getCheckoutPriceLabel(service) : null;
  const onlinePayAvailable = checkoutPrice?.showExactTotal ?? false;
  const usesChapa = onlinePayAvailable && isChapaOnlineMethod(method);

  useEffect(() => {
    if (!onlinePayAvailable) {
      setMethod(PAYMENT_METHOD_CASH);
    }
  }, [onlinePayAvailable]);

  const confirm = async () => {
    if (!user || !business || !service || !scheduledAt) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      setPaymentMethod(method);

      const booking = await createBooking({
        customerId: user.id,
        businessId: business.id,
        serviceId: service.id,
        scheduledAt,
        durationMinutes: service.duration_minutes,
        paymentMethod: method,
        paymentStatus: bookingPaymentStatusForMethod(method),
      });

      setBookingId(booking.id);
      queryClient.invalidateQueries({ queryKey: ["available-slots", business.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });

      if (usesChapa) {
        submittingRef.current = false;
        router.push({
          pathname: "/(app)/payment/checkout",
          params: { bookingId: booking.id },
        });
        return;
      }

      router.replace("/(app)/confirmation");
    } catch (error) {
      Alert.alert(t("payment.bookingFailed"), getErrorMessage(error));
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
          {checkoutPrice?.secondary ? (
            <Text style={styles.priceNote}>{checkoutPrice.secondary}</Text>
          ) : null}
        </View>

        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>{t("payment.cancellationPolicy")}</Text>
          <Text style={styles.policyText}>
            {getCancellationPolicyText(
              business.cancellation_hours ?? DEFAULT_CANCELLATION_HOURS,
            )}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>{t("payment.methodSection")}</Text>
        <View style={styles.methods}>
          {PAYMENT_OPTIONS.map((item) => {
            const active = method === item.id;
            const disabled = !onlinePayAvailable && item.id !== PAYMENT_METHOD_CASH;
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.method,
                  active && styles.methodActive,
                  disabled && styles.methodDisabled,
                ]}
                onPress={() => {
                  if (disabled) return;
                  setMethod(item.id);
                }}
              >
                <View style={[styles.methodIcon, { backgroundColor: item.color }]}>
                  <Text style={styles.methodEmoji}>{item.icon}</Text>
                </View>
                <View style={styles.methodText}>
                  <Text style={[styles.methodName, disabled && styles.methodNameDisabled]}>
                    {t(item.labelKey)}
                  </Text>
                  <Text style={styles.methodSub}>
                    {disabled ? t("payment.notAvailable") : t(item.descKey)}
                  </Text>
                </View>
                <View style={[styles.radio, active && styles.radioOn]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {usesChapa ? <Text style={styles.chapaNote}>{t("payment.chapaNote")}</Text> : null}

        <Button
          title={usesChapa ? t("payment.continueToPayment") : t("payment.confirmBooking")}
          onPress={confirm}
          loading={loading}
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
  methodDisabled: {
    opacity: 0.45,
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
  methodNameDisabled: { color: colors.textMuted },
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
  muted: { color: colors.textMuted },
});
