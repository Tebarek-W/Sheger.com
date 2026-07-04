import { Platform, type ViewStyle } from "react-native";

export const colors = {
  brandDark: "#0d4d0d",
  primary: "#1a7a1a",
  primaryDark: "#1a5c1a",
  primaryDarker: "#0d4d0d",
  accentLime: "#6ee86e",
  gold: "#e8b84a",
  goldMuted: "#d4a853",
  primaryLight: "#e4f5e4",
  screenBg: "#f5f9f5",
  background: "#ffffff",
  surface: "#f5f9f5",
  text: "#1a1a18",
  textSecondary: "#5f5e5a",
  textMuted: "#8a8985",
  textTertiary: "#b8b6b0",
  border: "#e8e6df",
  borderLight: "rgba(255,255,255,0.15)",
  white: "#ffffff",
  error: "#dc2626",
  errorBg: "#fef2f2",
  star: "#f5a623",
  gradientStart: "#0d4d0d",
  gradientEnd: "#1a7a1a",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

function shadow(
  offsetY: number,
  blurRadius: number,
  opacity: number,
  elevation: number,
): ViewStyle {
  return Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blurRadius,
    },
    default: { elevation },
  })!;
}

export const shadows = {
  sm: shadow(1, 3, 0.06, 1),
  md: shadow(2, 6, 0.08, 3),
  lg: shadow(4, 12, 0.12, 6),
  top: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    default: { elevation: 8 },
  })! as ViewStyle,
} as const;

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: "600" as const, lineHeight: 28 },
  h3: { fontSize: 16, fontWeight: "600" as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: "400" as const, lineHeight: 20 },
  bodyMedium: { fontSize: 14, fontWeight: "500" as const, lineHeight: 20 },
  small: { fontSize: 12, fontWeight: "400" as const, lineHeight: 17 },
  caption: { fontSize: 11, fontWeight: "400" as const, lineHeight: 15 },
  label: { fontSize: 13, fontWeight: "600" as const, lineHeight: 18 },
} as const;

export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}
