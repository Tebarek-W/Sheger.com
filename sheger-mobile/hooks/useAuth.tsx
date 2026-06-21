import { useQueryClient } from "@tanstack/react-query";
import { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  isPushNotificationsSupported,
} from "@/lib/notifications/push-support";
import { removePushTokenForUser } from "@/lib/notifications/register";
import { clearNotificationQueries } from "@/lib/notifications/query-keys";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types/database";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const notificationCleanupRef = useRef<(() => void) | null>(null);
  const prevUserIdRef = useRef<string | undefined>(undefined);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data);
    return data;
  };

  const setupPush = async (userId: string, role: Profile["role"] | undefined) => {
    notificationCleanupRef.current?.();
    notificationCleanupRef.current = null;

    if (!isPushNotificationsSupported()) {
      return;
    }

    const [{ setupNotificationHandlers }, { registerForPushNotifications, watchPushTokenRefresh }] =
      await Promise.all([
        import("@/lib/notifications/handler"),
        import("@/lib/notifications/register"),
      ]);

    const handlerCleanup = await setupNotificationHandlers(role);
    const tokenCleanup = await watchPushTokenRefresh(userId);
    notificationCleanupRef.current = () => {
      handlerCleanup();
      tokenCleanup();
    };
    await registerForPushNotifications(userId);
  };

  const refreshProfile = async () => {
    if (session?.user.id) {
      await loadProfile(session.user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) {
        const loaded = await loadProfile(data.session.user.id);
        await setupPush(data.session.user.id, loaded?.role);
        setLoading(false);
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      const nextUserId = next?.user.id;
      if (
        prevUserIdRef.current &&
        nextUserId &&
        prevUserIdRef.current !== nextUserId
      ) {
        clearNotificationQueries(queryClient);
      }
      prevUserIdRef.current = nextUserId;

      setSession(next);
      if (next?.user.id) {
        const loaded = await loadProfile(next.user.id);
        await setupPush(next.user.id, loaded?.role);
      } else {
        notificationCleanupRef.current?.();
        notificationCleanupRef.current = null;
        clearNotificationQueries(queryClient);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      listener.subscription.unsubscribe();
      notificationCleanupRef.current?.();
    };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signOut: async () => {
        clearNotificationQueries(queryClient);
        if (session?.user.id) {
          await removePushTokenForUser(session.user.id);
        }
        await supabase.auth.signOut();
      },
      refreshProfile,
    }),
    [session, profile, loading, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
