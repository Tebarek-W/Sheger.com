import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { createBooking } from "@/lib/api/bookings";
import { formatSlotDate, formatSlotLabel } from "@/lib/booking/slots";
import { getErrorMessage } from "@/lib/errors";
import { useBookingStore } from "@/stores/bookingStore";

const PAYMENT_METHODS = [
  { id: "cash", label: "Cash on arrival", desc: "Pay at the business" },
  { id: "telebirr", label: "Telebirr", desc: "Mobile money" },
  { id: "cbe_birr", label: "CBE Birr", desc: "Commercial Bank" },
  { id: "card", label: "Bank card", desc: "Visa / Mastercard" },
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
  const business = useBookingStore((s) => s.business);
  const service = useBookingStore((s) => s.service);
  const scheduledAt = useBookingStore((s) => s.scheduledAt);
  const setPaymentMethod = useBookingStore((s) => s.setPaymentMethod);
  const setBookingId = useBookingStore((s) => s.setBookingId);
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const confirm = async () => {
    if (!user || !business || !service || !scheduledAt) return;
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
      });
      setBookingId(booking.id);
      router.replace("/(app)/confirmation");
    } catch (error) {
      Alert.alert("Booking failed", getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (!business || !service || !scheduledAt) {
    return (
      <Screen>
        <Header title="Payment" showBack />
        <Text style={styles.muted}>Complete booking details first.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title="Payment" subtitle="Choose how you will pay" showBack />

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{service.name}</Text>
        <Text style={styles.summaryMeta}>{business.name}</Text>
        <Text style={styles.summaryMeta}>
          {formatSlotDate(scheduledAt)} · {formatSlotLabel(scheduledAt)}
        </Text>
        <Text style={styles.price}>{Number(service.price).toFixed(0)} ETB</Text>
      </View>

      <Text style={styles.section}>Payment method</Text>
      <View style={styles.methods}>
        {PAYMENT_METHODS.map((item) => {
          const active = method === item.id;
          return (
            <Pressable
              key={item.id}
              style={[styles.method, active && styles.methodActive]}
              onPress={() => setMethod(item.id)}
            >
              <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>
                {item.label}
              </Text>
              <Text style={[styles.methodDesc, active && styles.methodDescActive]}>
                {item.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Button title="Confirm Booking" onPress={confirm} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
    marginBottom: 24,
  },
  summaryTitle: { fontSize: 18, fontWeight: "700", color: colors.primaryDarker },
  summaryMeta: { fontSize: 14, color: colors.textMuted },
  price: { fontSize: 24, fontWeight: "800", color: colors.primary, marginTop: 8 },
  section: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker, marginBottom: 12 },
  methods: { gap: 10, marginBottom: 24 },
  method: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 16,
    backgroundColor: colors.white,
  },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  methodLabel: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  methodLabelActive: { color: colors.primaryDarker },
  methodDesc: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  methodDescActive: { color: colors.primaryDarker },
  muted: { color: colors.textMuted },
});
