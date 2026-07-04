import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { LicenseDocumentPicker } from "@/components/owner/LicenseDocumentPicker";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useI18n } from "@/hooks/useI18n";
import { useOwnerBusiness } from "@/hooks/useOwnerBusiness";
import { fetchBusinessDocuments, uploadBusinessDocument } from "@/lib/api/business-license";
import {
  getRequiredDocumentTypes,
  isHealthFacilityCategory,
  type LicenseFileSelection,
  validateLicenseFile,
} from "@/lib/documents/license-validation";
import { getErrorMessage } from "@/lib/errors";
import type { BusinessDocumentType } from "@/lib/types/database";

export default function CompleteLicensesScreen() {
  const { t } = useI18n();
  const { business } = useOwnerBusiness();
  const queryClient = useQueryClient();
  const categorySlug =
    (business as { categories?: { slug: string } | null } | null)?.categories?.slug ?? null;

  const { data: documents } = useQuery({
    queryKey: ["business-documents", business?.id],
    queryFn: () => fetchBusinessDocuments(business!.id),
    enabled: Boolean(business?.id),
  });

  const requiredTypes = getRequiredDocumentTypes(categorySlug);
  const existingTypes = new Set(documents?.map((d) => d.document_type) ?? []);
  const missingTypes = requiredTypes.filter((docType) => !existingTypes.has(docType));

  const [files, setFiles] = useState<Partial<Record<BusinessDocumentType, LicenseFileSelection>>>({});
  const [showErrors, setShowErrors] = useState(false);

  const requiresHealthLicense = isHealthFacilityCategory(categorySlug);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!business) throw new Error("No business found");

      for (const type of missingTypes) {
        const file = files[type];
        if (!file) continue;
        await uploadBusinessDocument(
          business.id,
          type,
          file.uri,
          file.name,
          file.mimeType,
          file.sizeBytes,
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business-documents", business?.id] });
      queryClient.invalidateQueries({ queryKey: ["owner-businesses"] });
      Alert.alert(t("owner.screens.licenses.uploadedTitle"), t("owner.screens.licenses.uploadedMessage"), [
        { text: t("common.ok"), onPress: () => router.back() },
      ]);
    },
    onError: (error) => Alert.alert(t("owner.screens.licenses.uploadFailedTitle"), getErrorMessage(error)),
  });

  const onSubmit = () => {
    for (const type of missingTypes) {
      const file = files[type];
      if (!file) {
        setShowErrors(true);
        Alert.alert(
          t("owner.screens.licenses.missingDocsTitle"),
          t("owner.screens.licenses.missingDocsMessage"),
        );
        return;
      }
      const validationError = validateLicenseFile(file);
      if (validationError) {
        setShowErrors(true);
        Alert.alert(t("owner.screens.licenses.invalidDocTitle"), validationError);
        return;
      }
    }
    setShowErrors(false);
    mutation.mutate();
  };

  const subtitle = useMemo(() => {
    if (!business) return t("owner.screens.licenses.uploadMissing");
    if (missingTypes.length === 0) return t("owner.screens.licenses.allOnFile");
    return t("owner.screens.licenses.uploadCount", {
      count: missingTypes.length,
      name: business.name,
    });
  }, [business, missingTypes.length, t]);

  if (!business) {
    return (
      <Screen>
        <Header title={t("owner.screens.licenses.title")} showBack />
        <Text style={styles.muted}>{t("owner.screens.licenses.registerFirst")}</Text>
      </Screen>
    );
  }

  if (business.status !== "pending") {
    return (
      <Screen>
        <Header title={t("owner.screens.licenses.title")} showBack />
        <Text style={styles.muted}>{t("owner.screens.licenses.pendingOnly")}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title={t("owner.screens.licenses.title")} subtitle={subtitle} showBack />

      {missingTypes.length === 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{t("owner.screens.licenses.allUploaded")}</Text>
        </View>
      ) : (
        <View style={styles.form}>
          {missingTypes.includes("trade_license") ? (
            <LicenseDocumentPicker
              documentType="trade_license"
              value={files.trade_license ?? null}
              onChange={(file) => setFiles((prev) => ({ ...prev, trade_license: file ?? undefined }))}
              showError={showErrors}
            />
          ) : null}

          {requiresHealthLicense && missingTypes.includes("health_facility_license") ? (
            <LicenseDocumentPicker
              documentType="health_facility_license"
              value={files.health_facility_license ?? null}
              onChange={(file) =>
                setFiles((prev) => ({ ...prev, health_facility_license: file ?? undefined }))
              }
              showError={showErrors}
            />
          ) : null}

          <Button
            title={t("owner.screens.licenses.uploadButton")}
            onPress={onSubmit}
            loading={mutation.isPending}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: ownerLayout.sectionGap, marginTop: 8 },
  muted: { marginTop: 16, color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  notice: {
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: ownerLayout.cardPadding,
    ...shadows.sm,
  },
  noticeText: { color: colors.primaryDarker, fontSize: 14, lineHeight: 20 },
});
