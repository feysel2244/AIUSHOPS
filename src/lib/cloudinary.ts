/**
 * Injects Cloudinary on-the-fly transformations into any stored Cloudinary URL.
 *
 * Why this matters:
 * - Images already in the DB were uploaded as raw originals (2-5 MB JPG/PNG).
 * - Cloudinary can resize + convert them to WebP/AVIF at delivery time -- but only
 *   if the transformation params are present in the URL.
 * - This helper patches the URL at render time so every <img> gets the optimised
 *   version, even for URLs stored before we added transforms to uploadImage.ts.
 *
 * Transformation flags:
 *   f_auto   -> serve WebP or AVIF to browsers that support them
 *   q_auto   -> Cloudinary auto-picks best quality (smaller file, same look)
 *   w_{max}  -> cap pixel width; never send a 4K original to a 64px thumbnail
 *   c_limit  -> only downscale; never upscale a small image
 */

const CLOUDINARY_UPLOAD_PATH = "/upload/";

/**
 * Returns an optimised Cloudinary URL.
 *
 * @param url   - Raw Cloudinary URL from the database (may already contain transforms).
 * @param width - Max display width in CSS pixels (default 800 for cards).
 *                Pass smaller values for thumbnails (e.g. 96 for shop logos).
 * @returns     - URL with f_auto,q_auto,w_N,c_limit inserted, or original if
 *                it is not a Cloudinary URL.
 */
export function cloudinaryOptimize(url: string | undefined | null, width = 800): string {
  if (!url) return "";

  // Only transform genuine Cloudinary delivery URLs
  if (!url.includes("res.cloudinary.com") || !url.includes(CLOUDINARY_UPLOAD_PATH)) {
    return url;
  }

  // Strip any existing transform segment so we can re-apply the correct one.
  // A transform segment sits between /upload/ and the next path component and
  // contains Cloudinary parameter notation (e.g. "f_auto,q_auto,w_1200").
  // We detect it by looking for an underscore inside that first segment —
  // version tokens like "v1234567890" never contain underscores.
  const stripTransforms = (u: string): string => {
    return u.replace(
      /\/upload\/([^/]+)\//,
      (_match, segment) => (segment.includes("_") ? "/upload/" : `/upload/${segment}/`),
    );
  };

  const cleanUrl = stripTransforms(url);

  return cleanUrl.replace(
    CLOUDINARY_UPLOAD_PATH,
    `/upload/f_auto,q_auto,w_${width},c_limit/`,
  );
}
