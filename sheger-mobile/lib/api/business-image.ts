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
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: contentTypeFor(ext), upsert: true });

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
  await supabase.storage
    .from(BUCKET)
    .remove([
      coverPath(businessId, "jpg"),
      coverPath(businessId, "png"),
      coverPath(businessId, "webp"),
    ]);

  const { error } = await supabase
    .from("businesses")
    .update({ cover_image_url: null })
    .eq("id", businessId);

  if (error) throw error;
}
