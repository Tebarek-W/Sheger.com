import { Linking } from "react-native";
import Constants from "expo-constants";

const DEFAULT_SUPPORT_EMAIL = "support@abora.com";

type SupportExtra = {
  supportEmail?: string;
};

function trim(value: string | undefined): string | undefined {
  const v = value?.trim();
  return v || undefined;
}

/** Public support inbox for store listings and in-app contact. */
export function getSupportEmail(): string {
  const extra = Constants.expoConfig?.extra as SupportExtra | undefined;
  return (
    trim(process.env.EXPO_PUBLIC_SUPPORT_EMAIL) ??
    trim(extra?.supportEmail) ??
    DEFAULT_SUPPORT_EMAIL
  );
}

export function getSupportMailto(subject?: string): string {
  const email = getSupportEmail();
  if (!subject) return `mailto:${email}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}`;
}

export async function openSupportEmail(subject?: string): Promise<void> {
  const url = getSupportMailto(subject);
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) {
    throw new Error(`Cannot open mail app for ${getSupportEmail()}`);
  }
  await Linking.openURL(url);
}
