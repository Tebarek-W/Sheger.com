import { router, type Href } from "expo-router";

import type { Profile, UserRole } from "@/lib/types/database";

export const CUSTOMER_HOME = "/(app)/(tabs)" as const;
export const ADMIN_BLOCKED_ROUTE = "/(auth)/admin-blocked" as const;
export const ACCOUNT_BLOCKED_ROUTE = "/(auth)/account-blocked" as const;

export type AppHomeRoute =
  | "/(owner)/dashboard"
  | typeof CUSTOMER_HOME
  | typeof ADMIN_BLOCKED_ROUTE
  | typeof ACCOUNT_BLOCKED_ROUTE;

export function isPlatformAdmin(role: UserRole | undefined): boolean {
  return role === "admin";
}

export function isAccountBlocked(
  profile: Pick<Profile, "is_blocked"> | null | undefined,
): boolean {
  return Boolean(profile?.is_blocked);
}

/** Route after sign-in. Platform admins and blocked accounts are not allowed in. */
export function getHomeRouteForRole(
  role: UserRole | undefined,
  profile?: Pick<Profile, "is_blocked"> | null,
): AppHomeRoute {
  if (isAccountBlocked(profile)) {
    return ACCOUNT_BLOCKED_ROUTE;
  }
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
