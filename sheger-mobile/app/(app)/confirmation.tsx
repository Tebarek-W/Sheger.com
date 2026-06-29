import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { DualDateTime } from "@/components/ui/DualDateTime";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { useI18n } from "@/hooks/useI18n";
import { CUSTOMER_HOME } from "@/lib/routing";
import { DEFAULT_CANCELLATION_HOURS, getCancellationPolicyText } from "@/lib/booking/cancellation";
import { isChapaOnlineMethod, paymentMethodLabel } from "@/lib/payment/methods";
import { formatServiceDuration, getCheckoutPriceLabel } from "@/lib/services/pricing";
import { useBookingStore } from "@/stores/bookingStore";

export default function ConfirmationScreen() {
  return (
    <RequireAuth>
      <ConfirmationScreenContent />
    </RequireAuth>
  );
}

function ConfirmationScreenContent() {
  const { t } = useI18n();
  const business = useBookingStore((s) => s.business);
  const service = useBookingStore((s) => s.service);
  const scheduledAt = useBookingStore((s) => s.scheduledAt);
  const paymentMethod = useBookingStore((s) => s.paymentMethod);
  const bookingId = useBookingStore((s) => s.bookingId);
  const chapaReceiptUrl = useBookingStore((s) => s.chapaReceiptUrl);
  const reset = useBookingStore((s) => s.reset);

  const checkoutPrice = service ? getCheckoutPriceLabel(service) : null;
  const paymentLabel = paymentMethodLabel(paymentMethod);
  const paidOnline = paymentMethod ? isChapaOnlineMethod(paymentMethod) : false;

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
        <Text style={styles.title}>{t("confirmation.title")}</Text>
        <Text style={styles.subtitle}>
          {t("confirmation.subtitle")}
          {paidOnline ? t("confirmation.paidNote") : ""}
        </Text>
        <Text style={styles.policy}>
          {getCancellationPolicyText(
            business?.cancellation_hours ?? DEFAULT_CANCELLATION_HOURS,
          )}{" "}
          {t("confirmation.policySuffix")}
        </Text>

        <View style={styles.card}>
          <Row label={t("confirmation.service")} value={service?.name ?? "—"} />
          <Row label={t("confirmation.business")} value={business?.name ?? "—"} />
          {service ? (
            <Row label={t("confirmation.duration")} value={formatServiceDuration(service)} />
          ) : null}
          {checkoutPrice ? (
            <Row label={t("confirmation.price")} value={checkoutPrice.primary} />
          ) : null}
          {scheduledAt ? (
            <View style={styles.whenBlock}>
              <Text style={styles.rowLabel}>{t("confirmation.when")}</Text>
              <DualDateTime iso={scheduledAt} variant="dark" compact />
            </View>
          ) : (
            <Row label={t("confirmation.when")} value="—" />
          )}
          <Row label={t("confirmation.payment")} value={paymentLabel} />
          <Row label={t("confirmation.status")} value={t("confirmation.statusPending")} />
          {bookingId ? (
            <Row label={t("confirmation.reference")} value={bookingId.slice(0, 8).toUpperCase()} />
          ) : null}
        </View>

        <Button title={t("confirmation.backHome")} variant="accent" onPress={done} />
        {paidOnline && chapaReceiptUrl ? (
          <Button
            title={t("confirmation.viewReceipt")}
            variant="outline"
            onPress={() => WebBrowser.openBrowserAsync(chapaReceiptUrl)}
          />
        ) : null}
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
    paddingHorizontal: 8,
  },
  policy: {
    textAlign: "center",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
    marginBottom: 8,
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
