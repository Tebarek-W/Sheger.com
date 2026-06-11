import { router, type Href } from "expo-router";

import type { UserRole } from "@/lib/types/database";

export function getHomeRouteForRole(role: UserRole | undefined): "/(owner)/dashboard" | "/(app)/home" {
  if (role === "business_owner") {
    return "/(owner)/dashboard";
  }
  return "/(app)/home";
}

export function goBackSafely(fallback: Href = "/(app)/home") {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
