import * as FileSystem from "expo-file-system/legacy";

import { base64ToBytes } from "@/lib/files/base64";
import { supabase } from "@/lib/supabase";

const BUCKET = "business-images";

function coverPath(businessId: string, ext: "jpg" | "png" | "webp") {
  return `${businessId}/cover.${ext}`;
}

function extFromUri(uri: string): "jpg" | "png" | "webp" {
  const lower = uri.split("?")[0].toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".webp")) return "webp";
  return "jpg";
}

function contentTypeFor(ext: "jpg" | "png" | "webp") {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function uploadBusinessCoverImage(
  businessId: string,
  localUri: string,
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("You must be signed in to upload a business photo.");
  }

  const ext = extFromUri(localUri);
  const path = coverPath(businessId, ext);

  // Read the picked file directly from disk. fetch(localUri).arrayBuffer() is
  // unreliable on Android/iOS for content:// and file:// URIs, so we use
  // expo-file-system to get base64 and decode it to an ArrayBuffer.
  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) {
    throw new Error("Could not read the selected image. Try another photo.");
  }
  const fileData = base64ToBytes(base64);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, fileData, { contentType: contentTypeFor(ext), upsert: true });

  if (uploadError) {
    throw new Error(
      uploadError.message.includes("row-level security")
        ? "Upload blocked by storage permissions. Apply the business-images storage migration in Supabase (20250613000011_business_images_storage.sql)."
        : uploadError.message,
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("businesses")
    .update({ cover_image_url: publicUrl })
    .eq("id", businessId)
    .eq("owner_id", session.user.id);

  if (updateError) throw updateError;
  return publicUrl;
}

export async function removeBusinessCoverImage(businessId: string) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("You must be signed in to update a business photo.");
  }

  const { error: removeError } = await supabase.storage
    .from(BUCKET)
    .remove([
      coverPath(businessId, "jpg"),
      coverPath(businessId, "png"),
      coverPath(businessId, "webp"),
    ]);

  if (removeError) throw removeError;

  const { error } = await supabase
    .from("businesses")
    .update({ cover_image_url: null })
    .eq("id", businessId)
    .eq("owner_id", session.user.id);

  if (error) throw error;
}
