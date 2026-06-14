import { router, type Href } from "expo-router";

import type { UserRole } from "@/lib/types/database";

export const CUSTOMER_HOME = "/(app)/(tabs)" as const;
export const ADMIN_BLOCKED_ROUTE = "/(auth)/admin-blocked" as const;

export type AppHomeRoute =
  | "/(owner)/dashboard"
  | typeof CUSTOMER_HOME
  | typeof ADMIN_BLOCKED_ROUTE;

export function isPlatformAdmin(role: UserRole | undefined): boolean {
  return role === "admin";
}

/** Route after sign-in. Platform admins are not allowed in the mobile app. */
export function getHomeRouteForRole(role: UserRole | undefined): AppHomeRoute {
  if (isPlatformAdmin(role)) {
    return ADMIN_BLOCKED_ROUTE;
  }
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
