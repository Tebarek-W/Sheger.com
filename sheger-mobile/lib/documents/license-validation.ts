import type { BusinessDocumentType } from "@/lib/types/database";

export const HEALTH_FACILITY_CATEGORY_SLUGS = ["clinics", "dentists"] as const;

export const MAX_LICENSE_FILE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_LICENSE_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

export type AllowedLicenseMimeType = (typeof ALLOWED_LICENSE_MIME_TYPES)[number];

export type LicenseFileSelection = {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

export const DOCUMENT_TYPE_LABELS: Record<BusinessDocumentType, string> = {
  trade_license: "Business/Trade License",
  health_facility_license: "Health Facility Operating License",
};

export function isHealthFacilityCategory(categorySlug: string | null | undefined): boolean {
  if (!categorySlug) return false;
  return (HEALTH_FACILITY_CATEGORY_SLUGS as readonly string[]).includes(categorySlug);
}

export function getRequiredDocumentTypes(
  categorySlug: string | null | undefined,
): BusinessDocumentType[] {
  const types: BusinessDocumentType[] = ["trade_license"];
  if (isHealthFacilityCategory(categorySlug)) {
    types.push("health_facility_license");
  }
  return types;
}

export function normalizeLicenseMimeType(mimeType: string | null | undefined): string | null {
  if (!mimeType) return null;
  const lower = mimeType.toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  if ((ALLOWED_LICENSE_MIME_TYPES as readonly string[]).includes(lower)) return lower;
  return null;
}

export function validateLicenseFile(file: LicenseFileSelection): string | null {
  const mime = normalizeLicenseMimeType(file.mimeType);
  if (!mime) {
    return "Only PDF, JPG, JPEG, and PNG files are accepted.";
  }
  if (file.sizeBytes <= 0) {
    return "The selected file appears to be empty.";
  }
  if (file.sizeBytes > MAX_LICENSE_FILE_BYTES) {
    return "File must be 10 MB or smaller.";
  }
  if (!file.name?.trim()) {
    return "The selected file must have a name.";
  }
  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
