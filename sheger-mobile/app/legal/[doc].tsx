import { Stack, useLocalSearchParams } from "expo-router";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { interpolateLegalBody, isLegalDocId, LEGAL_DOCS } from "@/lib/legal/documents";
import { getLegalDocUrl } from "@/lib/legal/urls";
import { getSupportEmail, openSupportEmail } from "@/lib/support";

function resolveDocParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

export default function LegalDocumentScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ doc?: string | string[] }>();
  const docParam = resolveDocParam(params.doc);
  const doc = docParam && isLegalDocId(docParam) ? LEGAL_DOCS[docParam] : null;
  const supportEmail = getSupportEmail();
  const webUrl = docParam && isLegalDocId(docParam) ? getLegalDocUrl(docParam) : null;

  const onSupport = async () => {
    try {
      await openSupportEmail(t("legal.supportSubject"));
    } catch {
      Alert.alert(t("legal.supportTitle"), supportEmail);
    }
  };

  const onOpenWeb = async () => {
    if (!webUrl) return;
    try {
      await Linking.openURL(webUrl);
    } catch {
      Alert.alert(t("legal.title"), webUrl);
    }
  };

  if (!doc) {
    return (
      <Screen>
        <Header title={t("legal.title")} showBack />
        <Text style={styles.muted}>{t("legal.notFound")}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Stack.Screen options={{ headerShown: false }} />
      <Header title={t(doc.titleKey)} showBack />
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{interpolateLegalBody(section.body, supportEmail)}</Text>
        </View>
      ))}
      <Pressable onPress={onSupport} style={styles.support}>
        <Text style={styles.supportLabel}>{t("legal.supportTitle")}</Text>
        <Text style={styles.supportEmail}>{supportEmail}</Text>
      </Pressable>
      {webUrl ? (
        <Pressable onPress={onOpenWeb} style={styles.webLink}>
          <Text style={styles.webLinkText}>{t("legal.viewOnWebsite")}</Text>
        </Pressable>
      ) : null}
      <Text style={styles.updated}>{t("legal.lastUpdated")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18, gap: 6 },
  heading: { fontSize: 15, fontWeight: "700", color: colors.text },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  support: {
    marginTop: 8,
    marginBottom: 8,
    gap: 4,
  },
  supportLabel: { fontSize: 13, fontWeight: "600", color: colors.text },
  supportEmail: { fontSize: 14, fontWeight: "600", color: colors.primary },
  webLink: { marginBottom: 12 },
  webLinkText: { fontSize: 13, fontWeight: "600", color: colors.primary },
  updated: {
    fontSize: 11,
    color: colors.textTertiary,
    marginBottom: 24,
  },
  muted: { color: colors.textMuted, marginTop: 12 },
});
