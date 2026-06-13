export const colors = {
  brandDark: "#0d4d0d",
  primary: "#1a7a1a",
  primaryDark: "#1a5c1a",
  primaryDarker: "#0d4d0d",
  accentLime: "#6ee86e",
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

export function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning,";
  if (hour < 17) return "Good afternoon,";
  return "Good evening,";
}
