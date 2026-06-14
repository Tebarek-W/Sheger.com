import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_BLOCKED_ROUTE, CUSTOMER_HOME, isPlatformAdmin } from "@/lib/routing";

export default function OwnerLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isPlatformAdmin(profile?.role)) {
    return <Redirect href={ADMIN_BLOCKED_ROUTE} />;
  }

  if (profile?.role !== "business_owner") {
    return <Redirect href={CUSTOMER_HOME} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
