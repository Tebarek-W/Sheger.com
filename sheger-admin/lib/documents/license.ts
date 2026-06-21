import type { BusinessDocumentType } from "@/lib/types/database";

export const HEALTH_FACILITY_CATEGORY_SLUGS = ["clinics", "dentists"] as const;

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
