import Constants from "expo-constants";
import * as Device from "expo-device";

export function isExpoGo(): boolean {
  return Constants.appOwnership === "expo";
}

export function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/** Remote push requires a physical device, EAS project ID, and a dev/production build (not Expo Go). */
export function isPushNotificationsSupported(): boolean {
  if (!Device.isDevice) return false;
  if (isExpoGo()) return false;
  return Boolean(getExpoProjectId());
}
