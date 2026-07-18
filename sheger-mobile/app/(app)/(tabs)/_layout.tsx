import { Tabs } from "expo-router";

import { CustomerTabBar } from "@/components/navigation/CustomerTabBar";
import { colors } from "@/constants/theme";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomerTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.screenBg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="nearby" options={{ title: "Nearby" }} />
      <Tabs.Screen name="search" options={{ title: "Search" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
