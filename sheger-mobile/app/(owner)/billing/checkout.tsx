import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { parseTxRefFromUrl, verifyChapaPayment } from "@/lib/api/chapa";
import { initializeChapaSubscriptionPayment } from "@/lib/api/subscription";
import { getChapaHttpsReturnUrlPrefix } from "@/lib/chapa/return-url";
import { getErrorMessage } from "@/lib/errors";
import type { BillingInterval } from "@/lib/types/database";

type CheckoutStatus = "preparing" | "browser" | "confirm" | "verifying" | "error" | "done";

function resolveParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

function resolveInterval(value: string | string[] | undefined): BillingInterval {
  const raw = resolveParam(value);
  return raw === "yearly" ? "yearly" : "monthly";
}

export default function OwnerBillingCheckoutScreen() {
  const params = useLocalSearchParams<{
    businessId?: string | string[];
    planId?: string | string[];
    interval?: string | string[];
    planName?: string | string[];
  }>();
  const businessId = resolveParam(params.businessId);
  const planId = resolveParam(params.planId);
  const interval = resolveInterval(params.interval);
  const planName = resolveParam(params.planName);

  const queryClient = useQueryClient();

  const [status, setStatus] = useState<CheckoutStatus>("preparing");
  const [message, setMessage] = useState("Preparing secure checkout…");
  const [txRef, setTxRef] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const startedRef = useRef(false);

  const finishSubscription = useCallback(
    async (paymentTxRef: string) => {
      setStatus("verifying");
      setMessage("Confirming your subscription payment…");
      await verifyChapaPayment(paymentTxRef);
      if (businessId) {
        queryClient.invalidateQueries({ queryKey: ["subscription-summary", businessId] });
        queryClient.invalidateQueries({ queryKey: ["subscription-payments", businessId] });
      }
      setStatus("done");
      setMessage("Subscription activated.");
      Alert.alert("Subscription active", "Your plan is now active.", [
        { text: "Done", onPress: () => router.replace("/(owner)/billing") },
      ]);
    },
    [businessId, queryClient],
  );

  const confirmPayment = useCallback(async () => {
    if (!txRef) return;
    try {
      await finishSubscription(txRef);
    } catch (error) {
      setStatus("confirm");
      setMessage(getErrorMessage(error));
    }
  }, [finishSubscription, txRef]);

  const openChapaCheckout = useCallback(
    async (url: string, paymentTxRef: string) => {
      const chapaReturnPrefix = getChapaHttpsReturnUrlPrefix();
      setStatus("browser");
      setMessage("Complete your payment in the Chapa window.");

      const session = await WebBrowser.openAuthSessionAsync(url, chapaReturnPrefix);

      const sessionUrl =
        session.type === "success" && session.url && !session.url.trimStart().startsWith("<!")
          ? session.url
          : null;

      if (session.type === "success" || sessionUrl) {
        const resolvedTxRef = parseTxRefFromUrl(sessionUrl ?? "") ?? paymentTxRef;
        try {
          await finishSubscription(resolvedTxRef);
          return;
        } catch {
          // Payment may still be processing on Chapa's side.
        }
      } else {
        try {
          setStatus("verifying");
          setMessage("Confirming your subscription payment…");
          await finishSubscription(paymentTxRef);
          return;
        } catch {
          // Fall through to manual confirm UI.
        }
      }

      setStatus("confirm");
      setMessage("Finished paying? Tap confirm to activate your subscription.");
    },
    [finishSubscription],
  );

  const startHostedCheckout = useCallback(async () => {
    if (!businessId || !planId) return;

    setStatus("preparing");
    setMessage("Preparing secure checkout…");

    try {
      const result = await initializeChapaSubscriptionPayment(businessId, planId, interval);
      setTxRef(result.tx_ref);
      setCheckoutUrl(result.checkout_url);
      await openChapaCheckout(result.checkout_url, result.tx_ref);
    } catch (error) {
      setStatus("error");
      setMessage(getErrorMessage(error));
    }
  }, [businessId, interval, openChapaCheckout, planId]);

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    if (!businessId || !planId || startedRef.current) return;
    startedRef.current = true;
    void startHostedCheckout();
  }, [businessId, planId, startHostedCheckout]);

  if (!businessId || !planId) {
    return (
      <Screen>
        <Header title="Subscription payment" showBack backTo="/(owner)/billing" />
        <Text style={styles.errorText}>Missing plan details. Please choose a plan again.</Text>
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.headerPad}>
          <Header
            title="Subscription payment"
            subtitle={planName ? `${planName} · ${interval}` : undefined}
            showBack
            backTo="/(owner)/billing"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Secure Chapa checkout</Text>
          <Text style={styles.infoText}>
            You'll be redirected to Chapa to complete your subscription payment. Your plan activates
            as soon as the payment is confirmed.
          </Text>
        </View>

        <View style={styles.center}>
          {status === "preparing" || status === "browser" || status === "verifying" ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : null}
          <Text style={status === "error" ? styles.errorText : styles.statusText}>{message}</Text>

          {status === "confirm" && checkoutUrl && txRef ? (
            <>
              <Button title="Open Chapa checkout" onPress={() => openChapaCheckout(checkoutUrl, txRef)} />
              <Button title="I've paid — confirm" variant="outline" onPress={confirmPayment} />
            </>
          ) : null}

          {status === "error" ? (
            <Button title="Try again" onPress={startHostedCheckout} />
          ) : null}

          {status === "error" || status === "confirm" ? (
            <Pressable onPress={() => router.replace("/(owner)/billing")}>
              <Text style={styles.cancelLink}>Back to billing</Text>
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
  headerPad: { paddingHorizontal: 16, paddingTop: 16 },
  infoCard: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  infoTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryDarker },
  infoText: { fontSize: 14, color: colors.textMuted, lineHeight: 21 },
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
  cancelLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
});
