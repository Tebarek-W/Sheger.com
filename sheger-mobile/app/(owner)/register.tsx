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
import { colors, radius } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
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

export default function RegisterBusinessScreen() {
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
        name,
        description,
        address,
        city,
        phone,
        email,
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
        "Business submitted",
        "Your business and license documents are pending admin review. You can set up services and hours while you wait.",
        [{ text: "OK", onPress: () => router.replace("/(owner)/dashboard") }],
      );
    },
    onError: (error) => {
      Alert.alert("Could not register", getErrorMessage(error));
    },
  });

  const onSubmit = () => {
    if (!name || !categoryId) {
      Alert.alert("Missing fields", "Enter a business name and select a category.");
      return;
    }
    if (!isWithinEthiopia(coords)) {
      Alert.alert(
        "Location required",
        "Set your business location so customers can find you in Nearby search.",
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
        Alert.alert("Missing documents", "Upload all required license documents before submitting.");
        return;
      }
      const validationError = validateLicenseFile(file);
      if (validationError) {
        setShowDocErrors(true);
        Alert.alert("Invalid document", validationError);
        return;
      }
    }

    setShowDocErrors(false);
    mutation.mutate();
  };

  return (
    <Screen scroll>
      <Header
        title="Register business"
        subtitle="Submit your business and licenses for admin approval"
        showBack
      />

      <View style={styles.form}>
        <Input label="Business name" value={name} onChangeText={setName} placeholder="e.g. Bole Premium Barbers" />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="What do you offer?"
          multiline
        />
        <Text style={styles.label}>Category</Text>
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
          <Text style={styles.sectionTitle}>Required documents</Text>
          <Text style={styles.sectionHint}>
            Upload clear copies of your licenses. All businesses need a trade license.
            {requiresHealthLicense
              ? " Clinics and dentists also need a health facility operating license."
              : ""}
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
          <Text style={styles.label}>Business location</Text>
          <Text style={styles.sectionHint}>
            Required. This places you on the map for Nearby search.
          </Text>
          <LocationPicker
            value={coords}
            onChange={setCoords}
            onResolveAddress={(resolved) => {
              if (!address.trim()) setAddress(resolved);
            }}
          />
        </View>

        <Input label="Address (area / street)" value={address} onChangeText={setAddress} placeholder="e.g. Bole Road, near Edna Mall" />
        <Input label="City" value={city} onChangeText={setCity} />
        <Input label="Phone" value={phone} onChangeText={setPhone} placeholder="+251..." keyboardType="phone-pad" />
        <Input
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Button title="Submit for approval" onPress={onSubmit} loading={mutation.isPending} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  label: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.primaryDarker },
  sectionHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  docSection: { gap: 12 },
  locationSection: { gap: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.primaryDarker, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.white },
});
