import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { colors } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (session && profile?.role === "business_owner") {
    return <Redirect href="/(owner)/dashboard" />;
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
