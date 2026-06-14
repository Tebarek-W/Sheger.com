import { Image, StyleSheet, Text, View } from "react-native";

import { getCategoryIcon, getCategoryTheme } from "@/constants/categories";
import { colors } from "@/constants/theme";

type BusinessThumbnailProps = {
  name: string;
  coverImageUrl?: string | null;
  categorySlug?: string | null;
  themeIndex?: number;
  size?: number;
  rounded?: boolean;
};

export function BusinessThumbnail({
  name,
  coverImageUrl,
  categorySlug,
  themeIndex = 0,
  size = 80,
  rounded = false,
}: BusinessThumbnailProps) {
  const theme = getCategoryTheme(themeIndex);
  const icon = getCategoryIcon(categorySlug ?? undefined);
  const radius = rounded ? size / 2 : 0;

  if (coverImageUrl) {
    return (
      <Image
        source={{ uri: coverImageUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: radius },
        ]}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.bg,
        },
      ]}
    >
      {categorySlug ? (
        <Text style={[styles.fallbackIcon, { color: theme.icon, fontSize: size * 0.38 }]}>
          {icon}
        </Text>
      ) : (
        <Text style={[styles.initial, { color: theme.icon, fontSize: size * 0.34 }]}>
          {name.charAt(0).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.screenBg },
  fallback: { alignItems: "center", justifyContent: "center" },
  fallbackIcon: { position: "absolute", opacity: 0.35 },
  initial: { fontWeight: "700" },
});
