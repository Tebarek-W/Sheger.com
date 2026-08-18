import { router } from "expo-router";
import { Alert } from "react-native";

import type { TranslateFn } from "@/lib/services/pricing";
import { getHomeRouteForRole } from "@/lib/routing";
import { supabase } from "@/lib/supabase";
import type { Business, Service, UserRole } from "@/lib/types/database";
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
    { text: t("common.signUp"), onPress: () => router.push("/(auth)/signup") },
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

export async function redirectAfterAuth(userId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_blocked, full_name")
    .eq("id", userId)
    .maybeSingle();
  const role = profile?.role as UserRole | undefined;

  if (profile?.is_blocked) {
    await supabase.auth.signOut();
    router.replace("/(auth)/account-blocked");
    return;
  }
  if (role === "admin") {
    await supabase.auth.signOut();
    router.replace("/(auth)/admin-blocked");
    return;
  }

  const pendingBook = getPendingBookingRoute();
  if (pendingBook && role === "customer") {
    router.replace(pendingBook);
    return;
  }

  router.replace(getHomeRouteForRole(role, profile));
}
