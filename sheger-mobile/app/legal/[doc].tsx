import { Stack, useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { isLegalDocId, LEGAL_DOCS } from "@/lib/legal/documents";

function resolveDocParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value?.trim() || null;
}

export default function LegalDocumentScreen() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ doc?: string | string[] }>();
  const docParam = resolveDocParam(params.doc);
  const doc = docParam && isLegalDocId(docParam) ? LEGAL_DOCS[docParam] : null;

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
      <View style={styles.banner}>
        <Text style={styles.bannerText}>{t("legal.placeholderNotice")}</Text>
      </View>
      {doc.sections.map((section) => (
        <View key={section.heading} style={styles.section}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.body}>{section.body}</Text>
        </View>
      ))}
      <Text style={styles.updated}>{t("legal.lastUpdated")}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#fff8e8",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#f0d9a0",
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  section: { marginBottom: 18, gap: 6 },
  heading: { fontSize: 15, fontWeight: "700", color: colors.text },
  body: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  updated: {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 8,
    marginBottom: 24,
  },
  muted: { color: colors.textMuted, marginTop: 12 },
});
