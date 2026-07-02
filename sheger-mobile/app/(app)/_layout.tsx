import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_BLOCKED_ROUTE, isPlatformAdmin } from "@/lib/routing";

export default function AppLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (session && isPlatformAdmin(profile?.role)) {
    return <Redirect href={ADMIN_BLOCKED_ROUTE} />;
  }

  if (session && profile?.role === "business_owner") {
    return <Redirect href="/(owner)/dashboard" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.screenBg },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="business/[id]" />
      <Stack.Screen name="book" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="confirmation" />
      <Stack.Screen name="category/[slug]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="edit-profile" />
    </Stack>
  );
}
