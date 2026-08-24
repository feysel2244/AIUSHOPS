import { supabase } from "./supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Returns an error string if the file is invalid,
 * or an empty string if the file is valid.
 */
export function validateImageFile(file: File): string {
  if (!file.type.startsWith("image/")) {
    return "File must be an image (JPEG, PNG, WebP, etc.).";
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File too large (max 5 MB). Yours is ${(
      file.size /
      1024 /
      1024
    ).toFixed(1)} MB.`;
  }

  return "";
}

/**
 * Upload a file to Supabase Storage
 * and return its public URL.
 *
 * This function is still used for your
 * existing Supabase Storage uploads.
 */
export async function uploadImage(
  bucket: string,
  path: string,
  file: File
): Promise<string> {
  const validationError = validateImageFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  if (!supabase.storage) {
    throw new Error(
      "Storage is not available. Please check your Supabase configuration."
    );
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Upload a product image to Cloudinary
 * through the Supabase Edge Function.
 *
 * Cloudinary credentials are kept inside
 * Supabase Edge Function secrets and are
 * never exposed to the browser.
 */
export async function uploadProductImage(
  file: File,
  shopId: string,
  productId: string
): Promise<string> {
  // Validate the image before uploading
  const validationError = validateImageFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  // Prepare form data
  const formData = new FormData();

  formData.append("file", file);
  formData.append("shop_id", shopId);
  formData.append("product_id", productId);

  // Send the image to the Supabase Edge Function
  const { data, error } = await supabase.functions.invoke(
    "upload-to-cloudinary",
    {
      body: formData,
    }
  );

  // Handle Edge Function errors
  if (error) {
    console.error(
      "Cloudinary Edge Function error:",
      error
    );

    throw new Error(error.message);
  }

  // Handle Cloudinary errors
  if (!data?.success || !data?.url) {
    console.error(
      "Cloudinary upload response:",
      data
    );

    throw new Error(
      data?.error || "Cloudinary upload failed."
    );
  }

  // Return the Cloudinary secure URL
  return data.url;
}