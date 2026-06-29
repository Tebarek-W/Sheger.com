import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
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
  const setChapaReceiptUrl = useBookingStore((s) => s.setChapaReceiptUrl);
  const [message, setMessage] = useState("Confirming your payment…");
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      if (!txRef) {
        setMessage("Payment reference missing.");
        return;
      }

      try {
        const verified = await verifyChapaPayment(txRef);
        const receiptRef = verified.chapa_reference ?? chapaReference ?? null;
        if (receiptRef) {
          setChapaReceiptUrl(buildChapaReceiptUrl(receiptRef));
        }
        if (business?.id) {
          queryClient.invalidateQueries({ queryKey: ["available-slots", business.id] });
        }
        queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });
        router.replace("/(app)/confirmation");
      } catch (error) {
        setMessage(getErrorMessage(error));
      }
    })();
  }, [business?.id, chapaReference, queryClient, setChapaReceiptUrl, txRef]);

  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.text}>{message}</Text>
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
