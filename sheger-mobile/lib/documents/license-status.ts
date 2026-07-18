import type { BusinessDocument, BusinessDocumentType } from "@/lib/types/database";

import { getRequiredDocumentTypes } from "./license-validation";

export function getMissingDocumentTypes(
  categorySlug: string | null | undefined,
  documents: Pick<BusinessDocument, "document_type">[],
): BusinessDocumentType[] {
  const required = getRequiredDocumentTypes(categorySlug);
  const uploaded = new Set(documents.map((d) => d.document_type));
  return required.filter((type) => !uploaded.has(type));
}
