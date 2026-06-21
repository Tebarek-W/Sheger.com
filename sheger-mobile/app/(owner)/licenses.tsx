import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { LicenseDocumentPicker } from "@/components/owner/LicenseDocumentPicker";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Screen } from "@/components/ui/Screen";
import { colors, radius } from "@/constants/theme";
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
  const missingTypes = requiredTypes.filter((t) => !existingTypes.has(t));

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
      Alert.alert("Documents uploaded", "Your licenses are pending admin review.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    },
    onError: (error) => Alert.alert("Upload failed", getErrorMessage(error)),
  });

  const onSubmit = () => {
    for (const type of missingTypes) {
      const file = files[type];
      if (!file) {
        setShowErrors(true);
        Alert.alert("Missing documents", "Upload all required license documents.");
        return;
      }
      const validationError = validateLicenseFile(file);
      if (validationError) {
        setShowErrors(true);
        Alert.alert("Invalid document", validationError);
        return;
      }
    }
    setShowErrors(false);
    mutation.mutate();
  };

  const subtitle = useMemo(() => {
    if (!business) return "Upload missing license documents";
    if (missingTypes.length === 0) return "All required documents are on file";
    return `Upload ${missingTypes.length} missing document(s) for ${business.name}`;
  }, [business, missingTypes.length]);

  if (!business) {
    return (
      <Screen>
        <Header title="License documents" showBack />
        <Text style={styles.muted}>Register a business first.</Text>
      </Screen>
    );
  }

  if (business.status !== "pending") {
    return (
      <Screen>
        <Header title="License documents" showBack />
        <Text style={styles.muted}>License uploads are only editable while your business is pending review.</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header title="License documents" subtitle={subtitle} showBack />

      {missingTypes.length === 0 ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>All required documents have been uploaded.</Text>
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

          <Button title="Upload documents" onPress={onSubmit} loading={mutation.isPending} />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, marginTop: 8 },
  muted: { marginTop: 16, color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  notice: {
    marginTop: 16,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.md,
    padding: 14,
  },
  noticeText: { color: colors.primaryDarker, fontSize: 14, lineHeight: 20 },
});
