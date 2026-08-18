import { Image } from "expo-image";
import { StyleSheet, View, type ViewStyle } from "react-native";

const logoSource = require("@/assets/logo.svg");

type BrandLogoProps = {
  size?: number;
  style?: ViewStyle;
  /** Subtle ring behind the logo (welcome / dark backgrounds). */
  framed?: boolean;
};

export function BrandLogo({ size = 88, style, framed = false }: BrandLogoProps) {
  const image = (
    <View style={[styles.logoWrap, { width: size, height: size }]}>
      <Image
        source={logoSource}
        style={{ width: size, height: size }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );

  if (!framed) {
    return <View style={style}>{image}</View>;
  }

  const pad = Math.round(size * 0.08);
  return (
    <View style={[styles.frame, { width: size + pad * 2, height: size + pad * 2, borderRadius: (size + pad * 2) / 2 }, style]}>
      {image}
    </View>
  );
}

const styles = StyleSheet.create({
  logoWrap: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  frame: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    marginBottom: 22,
  },
});
