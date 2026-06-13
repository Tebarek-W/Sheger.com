import { Image, StyleSheet, Text, View } from "react-native";

import { getCategoryIcon } from "@/constants/categories";
import { colors, radius } from "@/constants/theme";
import type { Business } from "@/lib/types/database";

type BusinessPhotosTabProps = {
  business: Business & { categories?: { slug: string } | null };
};

export function BusinessPhotosTab({ business }: BusinessPhotosTabProps) {
  const icon = getCategoryIcon(business.categories?.slug);
  const hasCover = Boolean(business.cover_image_url);

  return (
    <View style={styles.wrap}>
      {hasCover ? (
        <Image
          source={{ uri: business.cover_image_url! }}
          style={styles.cover}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderIcon}>{icon}</Text>
          <Text style={styles.placeholderText}>No photos uploaded yet</Text>
        </View>
      )}

      {business.description ? (
        <View style={styles.about}>
          <Text style={styles.aboutTitle}>About</Text>
          <Text style={styles.aboutText}>{business.description}</Text>
        </View>
      ) : null}

      {!hasCover && !business.description ? (
        <Text style={styles.muted}>Photos and gallery coming from the business soon.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  cover: {
    width: "100%",
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.screenBg,
  },
  placeholder: {
    height: 180,
    borderRadius: radius.lg,
    backgroundColor: colors.screenBg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholderIcon: { fontSize: 48, opacity: 0.35 },
  placeholderText: { fontSize: 13, color: colors.textSecondary },
  about: {
    backgroundColor: colors.screenBg,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  aboutTitle: { fontSize: 13, fontWeight: "600", color: colors.text },
  aboutText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  muted: { fontSize: 13, color: colors.textMuted, textAlign: "center", paddingVertical: 16 },
});
