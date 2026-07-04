import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { HEADER_GRADIENT_COLORS } from "@/components/navigation/CustomerTabHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";

type MenuItemConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export default function ProfileScreen() {
  const { session, profile, user, signOut } = useAuth();
  const { t } = useI18n();

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((part: string) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  if (!session) {
    return (
      <Screen scroll padded={false} backgroundColor={colors.screenBg}>
        <View style={styles.guestHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.guestName}>{t("common.guest")}</Text>
          <Text style={styles.hint}>{t("profile.guestHint")}</Text>
        </View>

        <View style={styles.body}>
          <Button title={t("common.signIn")} onPress={() => router.push("/(auth)/login")} />
          <Button
            title={t("common.createAccount")}
            variant="outline"
            onPress={() => router.push("/(auth)/signup")}
          />

          <LanguageSwitcher />
        </View>
      </Screen>
    );
  }

  const menuItems: MenuItemConfig[] = [
    { label: t("profile.editProfile"), icon: "create-outline", onPress: () => router.push("/(app)/edit-profile") },
    { label: t("profile.myBookings"), icon: "calendar-outline", onPress: () => router.push("/(app)/(tabs)/bookings") },
    { label: t("profile.searchServices"), icon: "search-outline", onPress: () => router.push("/(app)/(tabs)/search") },
  ];

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <LinearGradient
        colors={HEADER_GRADIENT_COLORS}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <SignOutButton onPress={signOut} variant="light" />
        </View>
        <View style={styles.avatarRing}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{initials}</Text>
          </View>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? t("profile.defaultName")}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </LinearGradient>

      <View style={styles.body}>
        <View style={styles.card}>
          <Row label={t("profile.phone")} value={profile?.phone ?? t("common.notSet")} />
          <View style={styles.divider} />
          <Row label={t("profile.accountType")} value={t("common.customer")} />
          <View style={styles.divider} />
          <Row
            label={t("profile.memberSince")}
            value={
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString("en-ET", {
                    month: "short",
                    year: "numeric",
                  })
                : "—"
            }
          />
        </View>

        {menuItems.map((item) => (
          <Pressable
            key={item.label}
            style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon} size={20} color={colors.primary} />
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.menuChevron}>›</Text>
          </Pressable>
        ))}

        <LanguageSwitcher />
      </View>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 30,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: "center",
    overflow: "hidden",
  },
  guestHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 8,
    gap: 10,
  },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    ...shadows.sm,
  },
  avatarText: { fontSize: 34 },
  avatarRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLargeText: { fontSize: 24, fontWeight: "700", color: colors.accentLime },
  name: { fontSize: 20, fontWeight: "600", color: colors.white },
  guestName: { ...typography.h2, color: colors.text },
  email: { fontSize: 13, color: "rgba(255,255,255,0.7)", marginTop: 4 },
  hint: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  body: { paddingHorizontal: 16, paddingTop: 22, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: 16,
    ...shadows.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    gap: 12,
  },
  rowLabel: { ...typography.small, color: colors.textSecondary },
  rowValue: { ...typography.label, fontSize: 13, color: colors.text, textAlign: "right", flex: 1 },
  menuItem: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadows.sm,
  },
  menuItemPressed: {
    transform: [{ scale: 0.98 }],
  },
  menuLabel: { ...typography.bodyMedium, color: colors.text, flex: 1 },
  menuChevron: { fontSize: 20, color: colors.textTertiary },
});
