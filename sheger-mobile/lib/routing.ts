import { router, type Href } from "expo-router";

import type { UserRole } from "@/lib/types/database";

export const CUSTOMER_HOME = "/(app)/(tabs)" as const;

export function getHomeRouteForRole(
  role: UserRole | undefined,
): "/(owner)/dashboard" | typeof CUSTOMER_HOME {
  if (role === "business_owner") {
    return "/(owner)/dashboard";
  }
  return CUSTOMER_HOME;
}

export function goBackSafely(fallback: Href = CUSTOMER_HOME) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
