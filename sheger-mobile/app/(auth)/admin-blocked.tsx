import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { CUSTOMER_HOME } from "@/lib/routing";

/**
 * Shown when a platform admin signs in on mobile.
 * Admins must use the web dashboard with a dedicated admin account.
 */
export default function AdminBlockedScreen() {
  const { profile, signOut } = useAuth();

  const onSignOut = async () => {
    await signOut();
    router.replace("/");
  };

  const onBrowseGuest = async () => {
    await signOut();
    router.replace(CUSTOMER_HOME);
  };

  return (
    <Screen scroll backgroundColor={colors.screenBg}>
      <View style={styles.wrap}>
        <View style={styles.iconRing}>
          <Text style={styles.icon}>🛡️</Text>
        </View>
        <Text style={styles.title}>Admin account</Text>
        <Text style={styles.subtitle}>
          {profile?.full_name?.trim()
            ? `${profile.full_name.trim()}, this`
            : "This"}{" "}
          account has platform admin access and cannot be used in the Sheger mobile app.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Use separate accounts</Text>
          <Text style={styles.cardText}>
            • Admin panel — sign in on the Sheger admin website with your admin email.
          </Text>
          <Text style={styles.cardText}>
            • Mobile app — use a different email registered as customer or business owner.
          </Text>
        </View>

        <Button title="Sign out" onPress={onSignOut} />
        <Button title="Browse as guest" variant="outline" onPress={onBrowseGuest} />
        <Text style={styles.footer}>
          If you need to book services, ask your administrator to set your personal email to
          customer role, or create a new mobile account.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 14,
  },
  iconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 8,
  },
  icon: { fontSize: 32 },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
    marginVertical: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: colors.primaryDark },
  cardText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  footer: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
    marginTop: 8,
  },
});
