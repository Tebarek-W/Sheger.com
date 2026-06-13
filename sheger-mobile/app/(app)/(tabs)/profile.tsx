import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";

export default function ProfileScreen() {
  const { session, profile, user, signOut } = useAuth();

  const initials = profile?.full_name
    ? profile.full_name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  if (!session) {
    return (
      <Screen backgroundColor={colors.screenBg}>
        <View style={styles.guest}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>👤</Text>
          </View>
          <Text style={styles.name}>Guest</Text>
          <Text style={styles.hint}>Sign in to manage your profile and bookings</Text>
          <Button title="Sign in" onPress={() => router.push("/(auth)/login")} />
          <Button
            title="Create account"
            variant="outline"
            onPress={() => router.push("/(auth)/signup")}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll padded={false} backgroundColor={colors.screenBg}>
      <View style={styles.header}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{profile?.full_name ?? "Sheger user"}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.card}>
          <Row label="Phone" value={profile?.phone ?? "Not set"} />
          <Row label="Account type" value="Customer" />
          <Row
            label="Member since"
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
          <Text style={styles.menuLabel}>My bookings</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Pressable
          style={styles.menuItem}
          onPress={() => router.push("/(app)/(tabs)/search")}
        >
          <Text style={styles.menuLabel}>Search services</Text>
          <Text style={styles.menuChevron}>›</Text>
        </Pressable>

        <Button title="Sign out" variant="outline" onPress={signOut} style={styles.signOut} />
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
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
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
  email: { fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 4 },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  guest: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 12,
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
  signOut: { marginTop: 8 },
});
