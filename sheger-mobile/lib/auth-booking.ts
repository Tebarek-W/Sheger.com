import { router } from "expo-router";
import { Alert } from "react-native";

import type { TranslateFn } from "@/lib/services/pricing";
import type { Business, Service } from "@/lib/types/database";
import { useBookingStore } from "@/stores/bookingStore";

export function setBookingDraft(business: Business, service: Service) {
  const { setBusiness, setService, setScheduledAt } = useBookingStore.getState();
  setBusiness(business);
  setService(service);
  setScheduledAt(null);
}

export function promptLoginToBook(business: Business, service: Service, t: TranslateFn) {
  setBookingDraft(business, service);
  Alert.alert(t("auth.signInToBook.title"), t("auth.signInToBook.message"), [
    { text: t("auth.signInToBook.notNow"), style: "cancel" },
    { text: t("common.signIn"), onPress: () => router.push("/(auth)/login") },
  ]);
}

export function getPendingBookingRoute(): "/(app)/book" | null {
  const { business, service } = useBookingStore.getState();
  if (business && service) {
    return "/(app)/book";
  }
  return null;
}
