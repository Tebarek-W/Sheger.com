import type {
  BusinessDocument,
  BusinessDocumentType,
  BusinessStatus,
} from "@/lib/types/database";

import { getRequiredDocumentTypes } from "./license";

export type DocumentApprovalSummary = {
  requiredTypes: BusinessDocumentType[];
  uploadedCount: number;
  approvedCount: number;
  allUploaded: boolean;
  allApproved: boolean;
  label: string;
};

export function summarizeDocumentApproval(
  categorySlug: string | null | undefined,
  documents: Pick<BusinessDocument, "document_type" | "status">[],
  businessStatus?: BusinessStatus,
): DocumentApprovalSummary {
  const requiredTypes = getRequiredDocumentTypes(categorySlug);
  const docMap = new Map(documents.map((d) => [d.document_type, d]));

  let uploadedCount = 0;
  let approvedCount = 0;

  for (const type of requiredTypes) {
    const doc = docMap.get(type);
    if (doc) uploadedCount += 1;
    if (doc?.status === "approved") approvedCount += 1;
  }

  const allUploaded = uploadedCount === requiredTypes.length;
  const allApproved = approvedCount === requiredTypes.length;

  let label = `${uploadedCount}/${requiredTypes.length} uploaded`;
  if (allApproved && businessStatus === "approved") {
    label = "Approved";
  } else if (allApproved) {
    label = "Ready to approve";
  } else if (allUploaded) {
    label = `${approvedCount}/${requiredTypes.length} approved`;
  }

  return {
    requiredTypes,
    uploadedCount,
    approvedCount,
    allUploaded,
    allApproved,
    label,
  };
}
