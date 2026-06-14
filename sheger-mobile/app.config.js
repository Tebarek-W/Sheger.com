const path = require("path");
const { load } = require("@expo/env");

// Ensure .env is loaded before reading process.env in this file
load(path.resolve(__dirname));

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.includes("your-project")) {
  console.warn(
    "[Sheger] EXPO_PUBLIC_SUPABASE_URL is missing or still a placeholder in .env",
  );
}

if (!supabaseAnonKey || supabaseAnonKey.includes("your-")) {
  console.warn(
    "[Sheger] Supabase API key is missing or still a placeholder in .env",
  );
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Sheger",
  slug: "sheger-mobile",
  scheme: "sheger",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.sheger.app",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Sheger uses your location to show nearby businesses.",
    },
  },
  android: {
    package: "com.sheger.app",
    adaptiveIcon: {
      backgroundColor: "#0d4d0d",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "Sheger uses your location to show nearby businesses.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Sheger needs access to your photos so you can add a business profile picture.",
      },
    ],
  ],
  extra: {
    supabaseUrl,
    supabaseAnonKey,
  },
};
