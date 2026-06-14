import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Alert, Image, Pressable, StyleSheet, Text, View } from "react-native";

import { BusinessThumbnail } from "@/components/business/BusinessThumbnail";
import { colors, radius } from "@/constants/theme";
import { removeBusinessCoverImage, uploadBusinessCoverImage } from "@/lib/api/business-image";
import { getErrorMessage } from "@/lib/errors";
import type { Business } from "@/lib/types/database";

type BusinessProfilePhotoProps = {
  business: Business & { categories?: { slug: string } | null };
};

export function BusinessProfilePhoto({ business }: BusinessProfilePhotoProps) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["owner-businesses"] });
  };

  const uploadMutation = useMutation({
    mutationFn: (uri: string) => uploadBusinessCoverImage(business.id, uri),
    onSuccess: () => {
      invalidate();
      Alert.alert("Saved", "Business profile photo updated.");
    },
    onError: (error) => Alert.alert("Upload failed", getErrorMessage(error)),
  });

  const removeMutation = useMutation({
    mutationFn: () => removeBusinessCoverImage(business.id),
    onSuccess: () => {
      invalidate();
      Alert.alert("Removed", "Business profile photo removed.");
    },
    onError: (error) => Alert.alert("Error", getErrorMessage(error)),
  });

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission needed",
        "Allow photo library access to add a business profile picture.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;
    uploadMutation.mutate(result.assets[0].uri);
  };

  const confirmRemove = () => {
    Alert.alert("Remove photo?", "Customers will see the default icon instead.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => removeMutation.mutate() },
    ]);
  };

  const busy = uploadMutation.isPending || removeMutation.isPending;
  const hasPhoto = Boolean(business.cover_image_url);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Profile photo</Text>
      <Text style={styles.hint}>Shown on search, nearby, and your public business page.</Text>

      <View style={styles.previewRow}>
        {hasPhoto ? (
          <Image
            source={{ uri: business.cover_image_url! }}
            style={styles.preview}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.preview}>
            <BusinessThumbnail
              name={business.name}
              categorySlug={business.categories?.slug}
              size={120}
            />
          </View>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
            onPress={pickPhoto}
            disabled={busy}
          >
            <Text style={styles.btnPrimaryText}>
              {busy ? "Saving..." : hasPhoto ? "Change photo" : "Add photo"}
            </Text>
          </Pressable>
          {hasPhoto ? (
            <Pressable
              style={[styles.btn, styles.btnOutline, busy && styles.btnDisabled]}
              onPress={confirmRemove}
              disabled={busy}
            >
              <Text style={styles.btnOutlineText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: colors.primaryDarker },
  hint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
  previewRow: { flexDirection: "row", gap: 16, alignItems: "center" },
  preview: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  actions: { flex: 1, gap: 10 },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnPrimaryText: { color: colors.white, fontWeight: "700", fontSize: 14 },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  btnOutlineText: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
});
