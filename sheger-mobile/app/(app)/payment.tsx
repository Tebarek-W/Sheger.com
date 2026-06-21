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
import { RequireAuth } from "@/hooks/useRequireAuth";
import { createBooking } from "@/lib/api/bookings";
import { DEFAULT_CANCELLATION_HOURS, getCancellationPolicyText } from "@/lib/booking/cancellation";
import { getErrorMessage } from "@/lib/errors";
import {
  formatServiceDuration,
  getCheckoutPriceLabel,
} from "@/lib/services/pricing";
import { useBookingStore } from "@/stores/bookingStore";

const PAYMENT_METHODS = [
  { id: "telebirr", label: "Telebirr", desc: "Pay with mobile money", icon: "📱", color: "#e4f5e4" },
  { id: "cbe_birr", label: "CBE Birr", desc: "Commercial Bank of Ethiopia", icon: "🏦", color: "#e6f1fb" },
  { id: "cash", label: "Cash on arrival", desc: "Pay at the business", icon: "💵", color: "#faeeda" },
  { id: "card", label: "Bank card", desc: "Visa / Mastercard", icon: "💳", color: "#eeedfe" },
];

const METHOD_LABELS: Record<string, string> = {
  telebirr: "Telebirr",
  cbe_birr: "CBE Birr",
  cash: "Cash on arrival",
  card: "Bank card",
};

export default function PaymentScreen() {
  return (
    <RequireAuth>
      <PaymentScreenContent />
    </RequireAuth>
  );
}

function PaymentScreenContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const business = useBookingStore((s) => s.business);
  const service = useBookingStore((s) => s.service);
  const scheduledAt = useBookingStore((s) => s.scheduledAt);
  const setPaymentMethod = useBookingStore((s) => s.setPaymentMethod);
  const setBookingId = useBookingStore((s) => s.setBookingId);
  const [method, setMethod] = useState("telebirr");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const checkoutPrice = service ? getCheckoutPriceLabel(service) : null;

  useEffect(() => {
    if (service?.pricing_model === "variable") {
      setMethod("cash");
    }
  }, [service?.pricing_model]);

  const confirm = async () => {
    if (!user || !business || !service || !scheduledAt) return;
    // Synchronous guard: state updates are async, so a fast double-tap could
    // otherwise enter this handler twice and create duplicate bookings.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    try {
      setPaymentMethod(METHOD_LABELS[method] ?? method);
      const booking = await createBooking({
        customerId: user.id,
        businessId: business.id,
        serviceId: service.id,
        scheduledAt,
        durationMinutes: service.duration_minutes,
        paymentMethod: method,
      });
      setBookingId(booking.id);
      queryClient.invalidateQueries({ queryKey: ["available-slots", business.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });
      router.replace("/(app)/confirmation");
    } catch (error) {
      Alert.alert("Booking failed", getErrorMessage(error));
      submittingRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  if (!business || !service || !scheduledAt) {
    return (
      <Screen padded={false}>
        <View style={styles.pad}>
          <BookingHeader title="Payment" />
          <Text style={styles.muted}>Complete booking details first.</Text>
        </View>
      </Screen>
    );
  }

  const price = checkoutPrice?.primary ?? "—";

  return (
    <Screen scroll padded={false}>
      <View style={styles.pad}>
        <BookingHeader title="Payment" />

        <View style={styles.summary}>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Service</Text>
            <Text style={styles.payValue}>{service.name}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Business</Text>
            <Text style={styles.payValue}>{business.name}</Text>
          </View>
          <View style={styles.payRow}>
            <Text style={styles.payLabel}>Duration</Text>
            <Text style={styles.payValue}>{formatServiceDuration(service)}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.payLabel}>Date & time</Text>
            <DualDateTime iso={scheduledAt} compact />
          </View>
          <View style={styles.divider} />
          <View style={styles.payRow}>
            <Text style={styles.totalLabel}>
              {checkoutPrice?.showExactTotal ? "Total" : "Price"}
            </Text>
            <Text style={styles.totalValue}>{price}</Text>
          </View>
          {checkoutPrice?.secondary ? (
            <Text style={styles.priceNote}>{checkoutPrice.secondary}</Text>
          ) : null}
        </View>

        <View style={styles.policyBox}>
          <Text style={styles.policyTitle}>Cancellation policy</Text>
          <Text style={styles.policyText}>
            {getCancellationPolicyText(
              business.cancellation_hours ?? DEFAULT_CANCELLATION_HOURS,
            )}
          </Text>
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

        <Button title="Confirm booking" onPress={confirm} loading={loading} />
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
  methods: { gap: 10, marginBottom: 24 },
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
  muted: { color: colors.textMuted },
});
