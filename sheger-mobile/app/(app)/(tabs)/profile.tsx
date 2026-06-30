import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { SignOutButton } from "@/components/ui/SignOutButton";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";

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

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <SignOutButton onPress={signOut} variant="light" />
        </View>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? t("profile.defaultName")}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Row label={t("profile.phone")} value={profile?.phone ?? t("common.notSet")} />
          <Row label={t("profile.accountType")} value={t("common.customer")} />
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

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push("/(app)/(tabs)/bookings")}
        >
          <Text style={styles.menuLabel}>{t("profile.myBookings")}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push("/(app)/(tabs)/search")}
        >
          <Text style={styles.menuLabel}>{t("profile.searchServices")}</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

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
    backgroundColor: colors.brandDark,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    alignItems: "center",
  },
  guestHeader: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 8,
    gap: 8,
  },
  headerTop: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 32 },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarLargeText: { fontSize: 24, fontWeight: "600", color: colors.accentLime },
  name: { fontSize: 20, fontWeight: "500", color: colors.white },
  guestName: { fontSize: 20, fontWeight: "500", color: colors.text },
  email: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  body: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  rowLabel: { fontSize: 13, color: colors.textSecondary },
  rowValue: { fontSize: 13, fontWeight: "500", color: colors.text, textAlign: "right", flex: 1 },
  menuItem: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuLabel: { fontSize: 14, fontWeight: "500", color: colors.text },
  menuChevron: { fontSize: 20, color: colors.textTertiary },
});
