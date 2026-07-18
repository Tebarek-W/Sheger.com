import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { LicenseDocumentPicker } from "@/components/owner/LicenseDocumentPicker";
import { LocationPicker } from "@/components/owner/LocationPicker";
import { Button } from "@/components/ui/Button";
import { Header } from "@/components/ui/Header";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { ownerLayout } from "@/constants/owner-layout";
import { colors, radius, shadows, typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import { uploadBusinessDocument } from "@/lib/api/business-license";
import { fetchCategories } from "@/lib/api/categories";
import { createBusiness } from "@/lib/api/owner";
import {
  getRequiredDocumentTypes,
  isHealthFacilityCategory,
  type LicenseFileSelection,
  validateLicenseFile,
} from "@/lib/documents/license-validation";
import { getErrorMessage } from "@/lib/errors";
import { isWithinEthiopia, type Coordinates } from "@/lib/location";
import type { BusinessDocumentType } from "@/lib/types/database";
import {
  isValidEmail,
  isValidEthiopianMobile,
  normalizeEmail,
  normalizeEthiopianMobile,
} from "@/lib/validation/contact";

export default function RegisterBusinessScreen() {
  const { t } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Addis Ababa");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [tradeLicenseFile, setTradeLicenseFile] = useState<LicenseFileSelection | null>(null);
  const [healthLicenseFile, setHealthLicenseFile] = useState<LicenseFileSelection | null>(null);
  const [showDocErrors, setShowDocErrors] = useState(false);

  const onChangePhone = (value: string) => {
    const sanitized = value.replace(/[^\d+]/g, "");
    const clamped = sanitized.startsWith("+") ? sanitized.slice(0, 13) : sanitized.slice(0, 10);
    setPhone(clamped);
  };

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const selectedCategory = useMemo(
    () => categories?.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const categorySlug = selectedCategory?.slug ?? null;
  const requiresHealthLicense = isHealthFacilityCategory(categorySlug);

  const mutation = useMutation({
    mutationFn: async () => {
      const business = await createBusiness({
        ownerId: user!.id,
        categoryId: categoryId!,
        name: name.trim(),
        description: description.trim(),
        address: address.trim(),
        city: city.trim(),
        phone: normalizeEthiopianMobile(phone) || undefined,
        email: normalizeEmail(email) || undefined,
        latitude: coords!.latitude,
        longitude: coords!.longitude,
      });

      const uploads: { type: BusinessDocumentType; file: LicenseFileSelection }[] = [
        { type: "trade_license", file: tradeLicenseFile! },
      ];
      if (requiresHealthLicense && healthLicenseFile) {
        uploads.push({ type: "health_facility_license", file: healthLicenseFile });
      }

      for (const upload of uploads) {
        await uploadBusinessDocument(
          business.id,
          upload.type,
          upload.file.uri,
          upload.file.name,
          upload.file.mimeType,
          upload.file.sizeBytes,
        );
      }

      return business;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["owner-businesses"] });
      queryClient.invalidateQueries({ queryKey: ["business-documents"] });
      Alert.alert(
        t("owner.screens.register.submittedTitle"),
        t("owner.screens.register.submittedMessage"),
        [{ text: t("common.ok"), onPress: () => router.replace("/(owner)/dashboard") }],
      );
    },
    onError: (error) => {
      Alert.alert(t("owner.screens.register.registerFailedTitle"), getErrorMessage(error));
    },
  });

  const onSubmit = () => {
    if (!name || !categoryId) {
      Alert.alert(
        t("owner.screens.register.missingFieldsTitle"),
        t("owner.screens.register.missingFieldsMessage"),
      );
      return;
    }
    if (!isWithinEthiopia(coords)) {
      Alert.alert(
        t("owner.screens.register.locationRequiredTitle"),
        t("owner.screens.register.locationRequiredMessage"),
      );
      return;
    }

    if (phone.trim() && !isValidEthiopianMobile(phone)) {
      Alert.alert(
        t("owner.screens.register.invalidPhoneTitle"),
        t("owner.screens.register.invalidPhoneMessage"),
      );
      return;
    }

    if (email.trim() && !isValidEmail(email)) {
      Alert.alert(
        t("owner.screens.register.invalidEmailTitle"),
        t("owner.screens.register.invalidEmailMessage"),
      );
      return;
    }

    const requiredTypes = getRequiredDocumentTypes(categorySlug);
    const files: Record<BusinessDocumentType, LicenseFileSelection | null> = {
      trade_license: tradeLicenseFile,
      health_facility_license: healthLicenseFile,
    };

    for (const type of requiredTypes) {
      const file = files[type];
      if (!file) {
        setShowDocErrors(true);
        Alert.alert(
          t("owner.screens.register.missingDocsTitle"),
          t("owner.screens.register.missingDocsMessage"),
        );
        return;
      }
      const validationError = validateLicenseFile(file);
      if (validationError) {
        setShowDocErrors(true);
        Alert.alert(t("owner.screens.register.invalidDocTitle"), validationError);
        return;
      }
    }

    setShowDocErrors(false);
    mutation.mutate();
  };

  return (
    <Screen scroll>
      <Header
        title={t("owner.screens.register.title")}
        subtitle={t("owner.screens.register.subtitle")}
        showBack
      />

      <View style={styles.form}>
        <Input
          label={t("owner.screens.register.businessName")}
          value={name}
          onChangeText={setName}
          placeholder={t("owner.screens.register.businessNamePlaceholder")}
        />
        <Input
          label={t("owner.screens.register.description")}
          value={description}
          onChangeText={setDescription}
          placeholder={t("owner.screens.register.descriptionPlaceholder")}
          multiline
        />
        <Text style={styles.label}>{t("owner.screens.register.category")}</Text>
        <View style={styles.chips}>
          {categories?.map((cat) => {
            const active = categoryId === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategoryId(cat.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.docSection}>
          <Text style={styles.sectionTitle}>{t("owner.screens.register.requiredDocs")}</Text>
          <Text style={styles.sectionHint}>
            {t("owner.screens.register.docsHint")}
            {requiresHealthLicense ? t("owner.screens.register.docsHintHealth") : ""}
          </Text>

          <LicenseDocumentPicker
            documentType="trade_license"
            value={tradeLicenseFile}
            onChange={setTradeLicenseFile}
            showError={showDocErrors}
          />

          {requiresHealthLicense ? (
            <LicenseDocumentPicker
              documentType="health_facility_license"
              value={healthLicenseFile}
              onChange={setHealthLicenseFile}
              showError={showDocErrors}
            />
          ) : null}
        </View>

        <View style={styles.locationSection}>
          <Text style={styles.label}>{t("owner.screens.register.businessLocation")}</Text>
          <Text style={styles.sectionHint}>{t("owner.screens.register.locationHintRequired")}</Text>
          <LocationPicker
            value={coords}
            onChange={setCoords}
            onResolveAddress={(resolved) => {
              if (!address.trim()) setAddress(resolved);
            }}
          />
        </View>

        <Input
          label={t("owner.screens.register.address")}
          value={address}
          onChangeText={setAddress}
          placeholder={t("owner.screens.register.addressPlaceholder")}
        />
        <Input label={t("owner.screens.register.city")} value={city} onChangeText={setCity} />
        <Input
          label={t("owner.screens.register.phone")}
          value={phone}
          onChangeText={onChangePhone}
          placeholder="+251..."
          keyboardType="phone-pad"
          maxLength={13}
        />
        <Input
          label={t("owner.screens.register.emailOptional")}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.agreeNote}>{t("owner.registerAgreeNote")}</Text>
        <Pressable onPress={() => router.push("/legal/business")}>
          <Text style={styles.agreeLink}>{t("owner.businessTermsLink")}</Text>
        </Pressable>

        <Button
          title={t("owner.screens.register.submit")}
          onPress={onSubmit}
          loading={mutation.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: ownerLayout.sectionGap },
  label: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker },
  sectionTitle: { ...typography.h3, fontWeight: "700", color: colors.primaryDarker },
  sectionHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  docSection: { gap: ownerLayout.cardGap },
  locationSection: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    ...shadows.sm,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.primaryDarker, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.white },
  agreeNote: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  agreeLink: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },
});
