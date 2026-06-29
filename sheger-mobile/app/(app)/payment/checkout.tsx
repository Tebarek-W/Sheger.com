import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { RequireAuth } from "@/hooks/useRequireAuth";
import { getChapaReturnUrlPrefix } from "@/lib/chapa/return-url";
import {
  cancelChapaPayment,
  initializeChapaBookingPayment,
  parseTxRefFromUrl,
  verifyChapaPayment,
} from "@/lib/api/chapa";
import { getErrorMessage } from "@/lib/errors";
import { useBookingStore } from "@/stores/bookingStore";

type CheckoutStatus = "preparing" | "browser" | "confirm" | "verifying" | "error";

export default function PaymentCheckoutScreen() {
  return (
    <RequireAuth>
      <PaymentCheckoutContent />
    </RequireAuth>
  );
}

function resolveBookingId(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

function PaymentCheckoutContent() {
  const params = useLocalSearchParams<{ bookingId?: string | string[] }>();
  const bookingId = resolveBookingId(params.bookingId);
  const queryClient = useQueryClient();
  const business = useBookingStore((s) => s.business);
  const setBookingId = useBookingStore((s) => s.setBookingId);

  const [status, setStatus] = useState<CheckoutStatus>("preparing");
  const [message, setMessage] = useState("Preparing secure checkout...");
  const [txRef, setTxRef] = useState<string | null>(null);
  const startedRef = useRef(false);

  const finishPaidBooking = useCallback(async (paymentTxRef: string) => {
    setStatus("verifying");
    setMessage("Confirming your payment...");
    await verifyChapaPayment(paymentTxRef);
    if (business?.id) {
      queryClient.invalidateQueries({ queryKey: ["available-slots", business.id] });
    }
    queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });
    router.replace("/(app)/confirmation");
  }, [business?.id, queryClient]);

  const confirmPayment = useCallback(async () => {
    if (!txRef) return;
    try {
      await finishPaidBooking(txRef);
    } catch (error) {
      setStatus("confirm");
      setMessage(getErrorMessage(error));
    }
  }, [finishPaidBooking, txRef]);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!bookingId || startedRef.current) return;
    startedRef.current = true;

    let active = true;

    (async () => {
      try {
        const result = await initializeChapaBookingPayment(bookingId);
        if (!active) return;

        setTxRef(result.tx_ref);
        setBookingId(bookingId);
        setStatus("browser");
        setMessage("Complete payment in the browser window.");

        const session = await WebBrowser.openAuthSessionAsync(
          result.checkout_url,
          getChapaReturnUrlPrefix(),
        );

        if (!active) return;

        const paymentTxRef =
          (session.type === "success" && session.url
            ? parseTxRefFromUrl(session.url)
            : null) ?? result.tx_ref;

        try {
          await finishPaidBooking(paymentTxRef);
          return;
        } catch {
          // Payment may still be processing, or the user closed the browser early.
        }

        setStatus("confirm");
        setMessage(
          "If you finished paying, close the browser and tap Confirm payment below.",
        );
      } catch (error) {
        if (!active) return;
        setStatus("error");
        setMessage(getErrorMessage(error));
        try {
          await cancelChapaPayment({ bookingId });
        } catch {
          // Booking may already be cancelled server-side.
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [bookingId, finishPaidBooking, setBookingId]);

  const onCancel = () => {
    Alert.alert(
      "Cancel payment?",
      "Your booking will be cancelled and the time slot will be released.",
      [
        { text: "Keep paying", style: "cancel" },
        {
          text: "Cancel booking",
          style: "destructive",
          onPress: async () => {
            WebBrowser.dismissBrowser();
            try {
              await cancelChapaPayment({ bookingId: bookingId!, txRef: txRef ?? undefined });
            } catch {
              // Ignore cleanup errors on manual cancel.
            }
            router.back();
          },
        },
      ],
    );
  };

  if (!bookingId) {
    return (
      <Screen padded={false} style={styles.screen}>
        <View style={styles.pad}>
          <BookingHeader title="Secure checkout" />
          <Text style={styles.errorText}>Booking not found.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <BookingHeader title="Secure checkout" />
          {status !== "error" ? (
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancelLink}>Cancel</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.center}>
          {status === "preparing" || status === "browser" || status === "verifying" ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : null}
          <Text style={status === "error" ? styles.errorText : styles.statusText}>{message}</Text>

          {status === "confirm" ? (
            <>
              <Text style={styles.hint}>
                You may see a short &quot;Payment complete&quot; page in the browser. That is
                normal — close it and confirm here.
              </Text>
              <Button
                title="Confirm payment"
                onPress={confirmPayment}
                loading={false}
              />
            </>
          ) : null}

          {status === "error" ? (
            <Pressable onPress={() => router.back()}>
              <Text style={styles.cancelLink}>Go back</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { flex: 1 },
  pad: { paddingHorizontal: 16, paddingTop: 8 },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancelLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  hint: {
    color: colors.textTertiary,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  errorText: {
    color: colors.text,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
