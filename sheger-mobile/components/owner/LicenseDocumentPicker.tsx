import * as DocumentPicker from "expo-document-picker";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { useI18n } from "@/hooks/useI18n";
import {
  formatFileSize,
  type LicenseFileSelection,
  validateLicenseFile,
} from "@/lib/documents/license-validation";
import type { BusinessDocumentType } from "@/lib/types/database";
import { colors, radius } from "@/constants/theme";

type LicenseDocumentPickerProps = {
  documentType: BusinessDocumentType;
  value: LicenseFileSelection | null;
  onChange: (file: LicenseFileSelection | null) => void;
  required?: boolean;
  showError?: boolean;
};

export function LicenseDocumentPicker({
  documentType,
  value,
  onChange,
  required = true,
  showError = false,
}: LicenseDocumentPickerProps) {
  const { t } = useI18n();
  const label =
    documentType === "trade_license"
      ? t("owner.components.licenseDocumentPicker.tradeLicense")
      : t("owner.components.licenseDocumentPicker.healthLicense");
  const missing = required && !value;
  const rawValidationError = value ? validateLicenseFile(value) : null;

  const mapValidationError = (error: string | null): string | null => {
    if (!error) return null;
    switch (error) {
      case "Only PDF, JPG, JPEG, and PNG files are accepted.":
        return t("owner.components.licenseDocumentPicker.errors.invalidType");
      case "The selected file appears to be empty.":
        return t("owner.components.licenseDocumentPicker.errors.empty");
      case "File must be 10 MB or smaller.":
        return t("owner.components.licenseDocumentPicker.errors.tooLarge");
      case "The selected file must have a name.":
        return t("owner.components.licenseDocumentPicker.errors.noName");
      default:
        return error;
    }
  };

  const validationError = mapValidationError(rawValidationError);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "image/jpeg", "image/png"],
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.length) return;

    const asset = result.assets[0];
    onChange({
      uri: asset.uri,
      name: asset.name ?? "document",
      mimeType: asset.mimeType ?? "application/octet-stream",
      sizeBytes: asset.size ?? 0,
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? " *" : ""}
      </Text>
      <Text style={styles.hint}>{t("owner.components.licenseDocumentPicker.hint")}</Text>

      {value ? (
        <View style={styles.fileCard}>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={2}>
              {value.name}
            </Text>
            <Text style={styles.fileMeta}>{formatFileSize(value.sizeBytes)}</Text>
          </View>
          <Pressable onPress={() => onChange(null)} hitSlop={8}>
            <Text style={styles.remove}>{t("owner.components.licenseDocumentPicker.remove")}</Text>
          </Pressable>
        </View>
      ) : (
        <Button
          title={t("owner.components.licenseDocumentPicker.chooseFile")}
          variant="secondary"
          onPress={pickFile}
        />
      )}

      {value && !validationError ? (
        <Button
          title={t("owner.components.licenseDocumentPicker.replaceFile")}
          variant="secondary"
          onPress={pickFile}
        />
      ) : null}

      {showError && missing ? (
        <Text style={styles.error}>
          {t("owner.components.licenseDocumentPicker.uploadRequired", { label: label.toLowerCase() })}
        </Text>
      ) : null}
      {showError && validationError ? (
        <Text style={styles.error}>{validationError}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  fileInfo: { flex: 1, gap: 4 },
  fileName: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker },
  fileMeta: { fontSize: 12, color: colors.textMuted },
  remove: { fontSize: 13, fontWeight: "600", color: colors.error },
  error: { fontSize: 12, color: colors.error, lineHeight: 16 },
});
