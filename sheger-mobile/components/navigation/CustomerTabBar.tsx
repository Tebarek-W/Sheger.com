import { Ionicons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/constants/theme";

type TabConfig = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
  fab?: boolean;
};

const TABS: TabConfig[] = [
  { name: "index", label: "Home", icon: "home-outline", iconFocused: "home" },
  { name: "nearby", label: "Nearby", icon: "location-outline", iconFocused: "location" },
  { name: "search", label: "Search", icon: "search", iconFocused: "search", fab: true },
  { name: "bookings", label: "Bookings", icon: "calendar-outline", iconFocused: "calendar" },
  { name: "profile", label: "Profile", icon: "person-outline", iconFocused: "person" },
];

export function CustomerTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((tab) => {
        const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
        if (routeIndex < 0) return null;

        const focused = state.index === routeIndex;
        const color = focused ? colors.primary : colors.textTertiary;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: state.routes[routeIndex].key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(state.routes[routeIndex].name);
          }
        };

        if (tab.fab) {
          return (
            <Pressable key={tab.name} onPress={onPress} style={styles.fabSlot}>
              <View style={styles.fab}>
                <Ionicons name={tab.icon} size={24} color={colors.white} />
              </View>
              <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable key={tab.name} onPress={onPress} style={styles.item}>
            <Ionicons
              name={focused ? tab.iconFocused : tab.icon}
              size={22}
              color={color}
            />
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingBottom: 2,
  },
  fabSlot: {
    flex: 1,
    alignItems: "center",
    marginTop: -18,
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.white,
    marginBottom: 3,
  },
  label: {
    fontSize: 10,
    color: colors.textTertiary,
  },
  labelActive: {
    color: colors.primary,
    fontWeight: "500",
  },
});
