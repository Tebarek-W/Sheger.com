import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { formatSlotDate, formatSlotLabel } from "@/lib/booking/slots";
import { useBookingStore } from "@/stores/bookingStore";

export default function ConfirmationScreen() {
  return (
    <RequireAuth>
      <ConfirmationScreenContent />
    </RequireAuth>
  );
}

function ConfirmationScreenContent() {
  const business = useBookingStore((s) => s.business);
  const service = useBookingStore((s) => s.service);
  const scheduledAt = useBookingStore((s) => s.scheduledAt);
  const paymentMethod = useBookingStore((s) => s.paymentMethod);
  const bookingId = useBookingStore((s) => s.bookingId);
  const reset = useBookingStore((s) => s.reset);

  const done = () => {
    reset();
    router.replace("/(app)/home");
  };

  return (
    <Screen>
      <View style={styles.center}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Booking confirmed!</Text>
        <Text style={styles.subtitle}>
          Your appointment is pending confirmation from the business.
        </Text>

        <View style={styles.card}>
          <Row label="Service" value={service?.name ?? "—"} />
          <Row label="Business" value={business?.name ?? "—"} />
          <Row
            label="When"
            value={
              scheduledAt
                ? `${formatSlotDate(scheduledAt)} · ${formatSlotLabel(scheduledAt)}`
                : "—"
            }
          />
          <Row label="Payment" value={paymentMethod ?? "—"} />
          <Row label="Status" value="Pending" />
          {bookingId ? <Row label="Reference" value={bookingId.slice(0, 8).toUpperCase()} /> : null}
        </View>

        <Button title="Back to Home" onPress={done} />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", gap: 16 },
  check: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  checkMark: { color: colors.white, fontSize: 36, fontWeight: "700" },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primaryDarker,
    textAlign: "center",
  },
  subtitle: { textAlign: "center", color: colors.textMuted, lineHeight: 22, marginBottom: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    width: "100%",
  },
  row: { gap: 2 },
  rowLabel: { fontSize: 12, color: colors.textMuted, fontWeight: "600" },
  rowValue: { fontSize: 16, color: colors.primaryDarker, fontWeight: "600" },
});
