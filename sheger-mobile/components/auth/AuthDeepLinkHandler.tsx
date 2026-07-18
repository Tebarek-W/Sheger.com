import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useRef } from "react";

import {
  createSessionFromUrl,
  isPasswordRecoveryUrl,
} from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";

/**
 * Handles password-recovery deep links and navigates to the reset screen.
 */
export function AuthDeepLinkHandler() {
  const handlingRef = useRef(false);

  useEffect(() => {
    const handleUrl = async (url: string | null) => {
      if (!url || handlingRef.current) return;
      if (!isPasswordRecoveryUrl(url) && !url.includes("reset-password")) {
        return;
      }

      handlingRef.current = true;
      try {
        const created = await createSessionFromUrl(url);
        if (created || url.includes("reset-password")) {
          router.replace("/(auth)/reset-password");
        }
      } catch (error) {
        if (__DEV__) {
          console.warn("[Sheger] password recovery deep link failed:", error);
        }
        router.replace("/(auth)/forgot-password");
      } finally {
        handlingRef.current = false;
      }
    };

    void Linking.getInitialURL().then((url) => {
      void handleUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      void handleUrl(url);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        router.replace("/(auth)/reset-password");
      }
    });

    return () => {
      subscription.remove();
      listener.subscription.unsubscribe();
    };
  }, []);

  return null;
}
