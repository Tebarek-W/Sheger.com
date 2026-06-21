import { Platform } from "react-native";

import {
  getExpoProjectId,
  isExpoGo,
  isPushNotificationsSupported,
} from "@/lib/notifications/push-support";
import { supabase } from "@/lib/supabase";
import type { PushPlatform } from "@/lib/types/notifications";

let notificationHandlerConfigured = false;

async function ensureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!isPushNotificationsSupported()) {
    if (__DEV__ && isExpoGo()) {
      console.info(
        "Push skipped in Expo Go — in-app notifications still work. Use `eas build --profile development` to test push.",
      );
    }
    return null;
  }

  const Notifications = await import("expo-notifications");
  await ensureNotificationHandler();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("bookings", {
      name: "Bookings",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const projectId = getExpoProjectId()!;
  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });
  const expoPushToken = tokenResponse.data;
  const platform: PushPlatform = Platform.OS === "ios" ? "ios" : "android";

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "expo_push_token" },
  );

  if (error) {
    console.warn("Failed to save push token", error.message);
  }

  return expoPushToken;
}

export async function removePushTokenForUser(userId: string): Promise<void> {
  await supabase.from("push_tokens").delete().eq("user_id", userId);
}

export async function watchPushTokenRefresh(userId: string): Promise<() => void> {
  if (!isPushNotificationsSupported()) {
    return () => {};
  }

  const Notifications = await import("expo-notifications");
  const subscription = Notifications.addPushTokenListener(async (token) => {
    const platform: PushPlatform = Platform.OS === "ios" ? "ios" : "android";
    const { error } = await supabase.from("push_tokens").upsert(
      {
        user_id: userId,
        expo_push_token: token.data,
        platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "expo_push_token" },
    );

    if (error) {
      console.warn("Failed to refresh push token", error.message);
    }
  });

  return () => subscription.remove();
}
