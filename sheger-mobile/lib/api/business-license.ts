import * as FileSystem from "expo-file-system/legacy";

import { normalizeLicenseMimeType } from "@/lib/documents/license-validation";
import { base64ToBytes } from "@/lib/files/base64";
import { supabase } from "@/lib/supabase";
import type { BusinessDocument, BusinessDocumentType } from "@/lib/types/database";

const BUCKET = "business-licenses";

function extForMime(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

function storagePath(businessId: string, documentType: BusinessDocumentType, mimeType: string) {
  return `${businessId}/${documentType}.${extForMime(mimeType)}`;
}

export async function fetchBusinessDocuments(businessId: string): Promise<BusinessDocument[]> {
  const { data, error } = await supabase
    .from("business_documents")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at");

  if (error) throw error;
  return (data ?? []) as BusinessDocument[];
}

export async function uploadBusinessDocument(
  businessId: string,
  documentType: BusinessDocumentType,
  localUri: string,
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): Promise<BusinessDocument> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("You must be signed in to upload license documents.");
  }

  const normalizedMime = normalizeLicenseMimeType(mimeType);
  if (!normalizedMime) {
    throw new Error("Only PDF, JPG, JPEG, and PNG files are accepted.");
  }

  const path = storagePath(businessId, documentType, normalizedMime);

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) {
    throw new Error("Could not read the selected file. Try another document.");
  }

  const fileData = base64ToBytes(base64);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileData, { contentType: normalizedMime, upsert: true });

  if (uploadError) {
    throw new Error(
      uploadError.message.includes("row-level security")
        ? "Upload blocked by storage permissions. Apply the business license migration in Supabase."
        : uploadError.message,
    );
  }

  const { data, error } = await supabase
    .from("business_documents")
    .upsert(
      {
        business_id: businessId,
        document_type: documentType,
        storage_path: path,
        file_name: fileName,
        mime_type: normalizedMime,
        file_size_bytes: sizeBytes,
        status: "pending_review",
        rejection_reason: null,
        reviewed_at: null,
        reviewed_by: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,document_type" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as BusinessDocument;
}
