import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { verifyChapaPayment } from "@/lib/api/chapa";
import { buildChapaReceiptUrl } from "@/lib/chapa/receipt";
import { getErrorMessage } from "@/lib/errors";
import { useBookingStore } from "@/stores/bookingStore";

export default function PaymentReturnScreen() {
  return (
    <RequireAuth>
      <PaymentReturnContent />
    </RequireAuth>
  );
}

function PaymentReturnContent() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{
    txRef?: string | string[];
    tx_ref?: string | string[];
    chapa_reference?: string | string[];
  }>();
  const txRef = Array.isArray(params.txRef)
    ? params.txRef[0]
    : params.txRef ?? (Array.isArray(params.tx_ref) ? params.tx_ref[0] : params.tx_ref);
  const chapaReference = Array.isArray(params.chapa_reference)
    ? params.chapa_reference[0]
    : params.chapa_reference;
  const queryClient = useQueryClient();
  const business = useBookingStore((s) => s.business);
  const setBookingId = useBookingStore((s) => s.setBookingId);
  const setChapaReceiptUrl = useBookingStore((s) => s.setChapaReceiptUrl);
  const [message, setMessage] = useState(t("payment.return.confirming"));
  const [failed, setFailed] = useState(false);
  const startedRef = useRef(false);

  const confirmPayment = useCallback(async () => {
    if (!txRef) {
      setFailed(true);
      setMessage(t("payment.return.referenceMissing"));
      return;
    }

    setFailed(false);
    setMessage(t("payment.return.confirming"));

    try {
      const verified = await verifyChapaPayment(txRef);
      if (verified.booking_id) {
        setBookingId(verified.booking_id);
      }
      const receiptRef = verified.chapa_reference ?? chapaReference ?? null;
      if (receiptRef) {
        setChapaReceiptUrl(buildChapaReceiptUrl(receiptRef));
      }
      if (business?.id) {
        queryClient.invalidateQueries({ queryKey: ["available-slots", business.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });

      if (verified.purpose === "subscription") {
        const subBusinessId = verified.business_id;
        if (subBusinessId) {
          queryClient.invalidateQueries({ queryKey: ["subscription-summary", subBusinessId] });
          queryClient.invalidateQueries({ queryKey: ["subscription-payments", subBusinessId] });
        }
        router.replace("/(owner)/billing");
        return;
      }

      router.replace("/(app)/confirmation");
    } catch (error) {
      setFailed(true);
      setMessage(getErrorMessage(error));
    }
  }, [
    business?.id,
    chapaReference,
    queryClient,
    setBookingId,
    setChapaReceiptUrl,
    t,
    txRef,
  ]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void confirmPayment();
  }, [confirmPayment]);

  return (
    <Screen>
      <View style={styles.center}>
        {!failed ? <ActivityIndicator size="large" color={colors.primary} /> : null}
        <Text style={styles.text}>{message}</Text>
        {failed ? (
          <>
            {txRef ? (
              <Button title={t("payment.return.retry")} onPress={confirmPayment} />
            ) : null}
            <Button
              title={t("payment.return.goBack")}
              variant="outline"
              onPress={() => router.back()}
            />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  text: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
