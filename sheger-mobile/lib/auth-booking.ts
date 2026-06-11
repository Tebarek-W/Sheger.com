import { router } from "expo-router";
import { Alert } from "react-native";

import type { Business, Service } from "@/lib/types/database";
import { useBookingStore } from "@/stores/bookingStore";

export function setBookingDraft(business: Business, service: Service) {
  const { setBusiness, setService, setScheduledAt } = useBookingStore.getState();
  setBusiness(business);
  setService(service);
  setScheduledAt(null);
}

export function promptLoginToBook(business: Business, service: Service) {
  setBookingDraft(business, service);
  Alert.alert(
    "Sign in to book",
    "Create a free account or sign in to book this service on Sheger.",
    [
      { text: "Not now", style: "cancel" },
      { text: "Sign in", onPress: () => router.push("/(auth)/login") },
    ],
  );
}

export function getPendingBookingRoute(): "/(app)/book" | null {
  const { business, service } = useBookingStore.getState();
  if (business && service) {
    return "/(app)/book";
  }
  return null;
}
