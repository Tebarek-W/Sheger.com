import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { DualDateTime } from "@/components/ui/DualDateTime";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { CUSTOMER_HOME } from "@/lib/routing";
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
    router.replace(CUSTOMER_HOME);
  };

  return (
    <Screen backgroundColor={colors.brandDark}>
      <View style={styles.center}>
        <View style={styles.check}>
          <Text style={styles.checkMark}>✓</Text>
        </View>
        <Text style={styles.title}>Booking confirmed!</Text>
        <Text style={styles.subtitle}>
          Your appointment is pending confirmation from the business. You&apos;ll receive a
          notification once it&apos;s approved.
        </Text>

        <View style={styles.card}>
          <Row label="Service" value={service?.name ?? "—"} />
          <Row label="Business" value={business?.name ?? "—"} />
          {scheduledAt ? (
            <View style={styles.whenBlock}>
              <Text style={styles.rowLabel}>When</Text>
              <DualDateTime iso={scheduledAt} variant="dark" compact />
            </View>
          ) : (
            <Row label="When" value="—" />
          )}
          <Row label="Payment" value={paymentMethod ?? "—"} />
          <Row label="Status" value="Pending" />
          {bookingId ? (
            <Row label="Reference" value={bookingId.slice(0, 8).toUpperCase()} />
          ) : null}
        </View>

        <Button title="Back to home" variant="accent" onPress={done} />
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    gap: 16,
  },
  check: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(110,232,110,0.2)",
    borderWidth: 2,
    borderColor: colors.accentLime,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: colors.accentLime, fontSize: 36, fontWeight: "500" },
  title: {
    fontSize: 22,
    fontWeight: "500",
    color: colors.white,
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.lg,
    padding: 16,
    width: "100%",
    gap: 4,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 12,
  },
  whenBlock: { paddingVertical: 6, gap: 6 },
  rowLabel: { fontSize: 12, color: "rgba(255,255,255,0.5)", flex: 1 },
  rowValue: {
    fontSize: 12,
    color: "rgba(255,255,255,0.9)",
    fontWeight: "500",
    textAlign: "right",
    flex: 1,
  },
});
