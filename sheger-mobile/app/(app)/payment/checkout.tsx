import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { BookingHeader } from "@/components/ui/BookingHeader";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { RequireAuth } from "@/hooks/useRequireAuth";
import {
  cancelChapaPayment,
  initializeChapaBookingPayment,
  parseTxRefFromUrl,
  verifyChapaPayment,
} from "@/lib/api/chapa";
import { getChapaHttpsReturnUrlPrefix } from "@/lib/chapa/return-url";
import { buildChapaReceiptUrl, parseChapaReferenceFromUrl } from "@/lib/chapa/receipt";
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const business = useBookingStore((s) => s.business);
  const setBookingId = useBookingStore((s) => s.setBookingId);
  const setChapaReceiptUrl = useBookingStore((s) => s.setChapaReceiptUrl);

  const [status, setStatus] = useState<CheckoutStatus>("preparing");
  const [message, setMessage] = useState(() => t("payment.checkout.preparing"));
  const [txRef, setTxRef] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const startedRef = useRef(false);

  const finishPaidBooking = useCallback(
    async (paymentTxRef: string, returnUrl?: string | null) => {
      setStatus("verifying");
      setMessage(t("payment.checkout.verifying"));
      const verified = await verifyChapaPayment(paymentTxRef);
      const chapaRef =
        verified.chapa_reference ??
        (returnUrl ? parseChapaReferenceFromUrl(returnUrl) : null);
      if (chapaRef) {
        setChapaReceiptUrl(buildChapaReceiptUrl(chapaRef));
      }
      if (business?.id) {
        queryClient.invalidateQueries({ queryKey: ["available-slots", business.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["customer-bookings"] });
      router.replace("/(app)/confirmation");
    },
    [business?.id, queryClient, setChapaReceiptUrl, t],
  );

  const confirmPayment = useCallback(async () => {
    if (!txRef) return;
    try {
      await finishPaidBooking(txRef);
    } catch (error) {
      setStatus("confirm");
      setMessage(getErrorMessage(error));
    }
  }, [finishPaidBooking, txRef]);

  const openChapaCheckout = useCallback(
    async (url: string, paymentTxRef: string) => {
      const chapaReturnPrefix = getChapaHttpsReturnUrlPrefix();
      setStatus("browser");
      setMessage(t("payment.checkout.browserMessage"));

      const session = await WebBrowser.openAuthSessionAsync(url, chapaReturnPrefix);

      const sessionUrl =
        session.type === "success" && session.url && !session.url.trimStart().startsWith("<!")
          ? session.url
          : null;

      if (session.type === "success" || sessionUrl) {
        const resolvedTxRef = parseTxRefFromUrl(sessionUrl ?? "") ?? paymentTxRef;
        try {
          await finishPaidBooking(resolvedTxRef, sessionUrl);
          return;
        } catch {
          // Payment may still be processing on Chapa's side.
        }
      }

      setStatus("confirm");
      setMessage(t("payment.checkout.confirmHint"));
    },
    [finishPaidBooking, t],
  );

  const startHostedCheckout = useCallback(async () => {
    if (!bookingId) return;

    setStatus("preparing");
    setMessage(t("payment.checkout.preparing"));

    try {
      const result = await initializeChapaBookingPayment(bookingId);
      setTxRef(result.tx_ref);
      setCheckoutUrl(result.checkout_url);
      setBookingId(bookingId);
      await openChapaCheckout(result.checkout_url, result.tx_ref);
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
      try {
        await cancelChapaPayment({ bookingId });
      } catch {
        // Booking may already be cancelled server-side.
      }
    }
  }, [bookingId, openChapaCheckout, setBookingId, t]);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!bookingId || startedRef.current) return;
    startedRef.current = true;
    void startHostedCheckout();
  }, [bookingId, startHostedCheckout]);

  const onCancel = () => {
    Alert.alert(
      t("payment.checkout.cancelTitle"),
      t("payment.checkout.cancelMessage"),
      [
        { text: t("payment.checkout.cancelKeep"), style: "cancel" },
        {
          text: t("payment.checkout.cancelConfirm"),
          style: "destructive",
          onPress: async () => {
            WebBrowser.dismissBrowser();
            try {
              const result = await cancelChapaPayment({
                bookingId: bookingId!,
                txRef: txRef ?? undefined,
              });
              if (result?.paid && txRef) {
                await finishPaidBooking(txRef);
                return;
              }
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
          <BookingHeader title={t("payment.checkout.title")} />
          <Text style={styles.errorText}>{t("payment.checkout.bookingNotFound")}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <BookingHeader title={t("payment.checkout.title")} />
          {status !== "error" ? (
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancelLink}>{t("payment.checkout.cancelLink")}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t("payment.checkout.hostedTitle")}</Text>
          <Text style={styles.infoText}>{t("payment.checkout.hostedText")}</Text>
          <Text style={styles.infoNote}>{t("payment.checkout.testModeNote")}</Text>
        </View>

        <View style={styles.center}>
          {status === "preparing" || status === "browser" || status === "verifying" ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : null}
          <Text style={status === "error" ? styles.errorText : styles.statusText}>{message}</Text>

          {status === "confirm" && checkoutUrl && txRef ? (
            <>
              <Button
                title={t("payment.checkout.openChapa")}
                onPress={() => openChapaCheckout(checkoutUrl, txRef)}
              />
              <Button
                title={t("payment.checkout.confirmPayment")}
                variant="outline"
                onPress={confirmPayment}
              />
            </>
          ) : null}

          {status === "error" ? (
            <Pressable onPress={() => router.back()}>
              <Text style={styles.cancelLink}>{t("payment.checkout.goBack")}</Text>
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
  infoCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryDarker },
  infoText: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
  infoNote: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
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
  errorText: {
    color: colors.text,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
