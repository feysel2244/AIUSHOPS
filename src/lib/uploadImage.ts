import { supabase } from "./supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Returns an error string if the file is invalid, or "" if OK.
 * Call this before uploadImage to show immediate client-side feedback.
 */
export function validateImageFile(file: File): string {
  if (!file.type.startsWith("image/")) return "File must be an image (JPEG, PNG, WebP, etc.).";
  if (file.size > MAX_FILE_SIZE)
    return `File too large (max 5 MB). Yours is ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
  return "";
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 * - Validates size/type first (throws on validation failure).
 */
export async function uploadImage(bucket: string, path: string, file: File): Promise<string> {
  const validationError = validateImageFile(file);
  if (validationError) throw new Error(validationError);

  if (!supabase.storage) {
    throw new Error("Storage is not available. Please check your Supabase configuration.");
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: false,
    contentType: file.type,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
