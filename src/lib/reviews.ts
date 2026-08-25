import { supabase } from "./supabase";
import { normalizeRating } from "./marketData";

export const MAX_REVIEWS_PER_SHOP = 2;

export async function countUserShopReviews(userId: string, shopId: string) {
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("author_id", userId)
    .eq("shop_id", shopId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function refreshShopRating(shopId: string) {
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("shop_id", shopId);

  if (error) throw new Error(error.message);

  const ratings = (data ?? []).map((row) => normalizeRating(row.rating)).filter((rating) => rating > 0);
  const reviewCount = ratings.length;
  const rating = reviewCount
    ? Number((ratings.reduce((sum, value) => sum + value, 0) / reviewCount).toFixed(1))
    : 0;

  const { error: rpcError } = await supabase.rpc("update_shop_rating_from_reviews", {
    target_shop_id: shopId,
  });
  if (!rpcError) return { rating, reviewCount };

  const { error: updateError } = await supabase
    .from("shops")
    .update({ rating, review_count: reviewCount })
    .eq("id", shopId);

  if (updateError) throw new Error(updateError.message);
  return { rating, reviewCount };
}
