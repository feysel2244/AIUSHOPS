import { supabase } from "./supabase";
import { uploadImage } from "./uploadImage";

export type QuickListingCondition = "new" | "like_new" | "good" | "fair";
export type QuickListingStatus    = "active" | "sold" | "expired" | "removed";

export const CONDITION_LABELS: Record<QuickListingCondition, string> = {
  new:      "New",
  like_new: "Like New",
  good:     "Good",
  fair:     "Fair",
};

export const CONDITION_COLORS: Record<QuickListingCondition, string> = {
  new:      "bg-green-50 text-green-700 border-green-200",
  like_new: "bg-blue-50  text-blue-700  border-blue-200",
  good:     "bg-stone-50 text-stone-600 border-stone-200",
  fair:     "bg-amber-50 text-amber-700 border-amber-200",
};

export const MAX_QUICK_LISTINGS = 5;

// ─── Row shape returned from Supabase ────────────────────────────────────────

export type QuickListingRow = {
  id: string;
  seller_id: string;
  title: string;
  description: string | null;
  price: number;
  condition: QuickListingCondition;
  category: string;
  images: string[];
  pickup_location: string;
  status: QuickListingStatus;
  expires_at: string;
  created_at: string;
  profiles?: {
    name?: string | null;
    year?: string | null;
    whatsapp?: string | null;
  } | null;
};

// ─── Normalised shape used by UI ─────────────────────────────────────────────

export type QuickListing = {
  id: string;
  sellerId: string;
  sellerName: string;
  sellerYear: string;
  sellerWhatsapp: string;
  title: string;
  description: string;
  price: number;
  condition: QuickListingCondition;
  conditionLabel: string;
  category: string;
  images: string[];
  pickupLocation: string;
  status: QuickListingStatus;
  expiresAt: string;
  createdAt: string;
};

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&auto=format";

export function toQuickListing(row: QuickListingRow): QuickListing {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id:             row.id,
    sellerId:       row.seller_id,
    sellerName:     profile?.name     ?? "AIU Student",
    sellerYear:     profile?.year     ?? "",
    sellerWhatsapp: profile?.whatsapp ?? "",
    title:          row.title,
    description:    row.description   ?? "",
    price:          Number(row.price),
    condition:      row.condition,
    conditionLabel: CONDITION_LABELS[row.condition] ?? row.condition,
    category:       row.category,
    images:         row.images?.length ? row.images : [FALLBACK_IMAGE],
    pickupLocation: row.pickup_location,
    status:         row.status,
    expiresAt:      row.expires_at,
    createdAt:      row.created_at,
  };
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

/** Fetch all active public listings */
export async function fetchQuickListings(opts?: {
  category?: string;
  search?: string;
  limit?: number;
}): Promise<QuickListing[]> {
  let q = supabase
    .from("quick_listings")
    .select("*")
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 100);

  if (opts?.category) q = q.eq("category", opts.category);
  if (opts?.search)   q = q.ilike("title", `%${opts.search}%`);

  const { data, error } = await q;
  if (error) throw error;
  if (!data?.length) return [];

  // Fetch seller profiles in one round-trip
  const sellerIds = [...new Set(data.map((r: any) => r.seller_id as string))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id,name,year,whatsapp")
    .in("id", sellerIds);

  const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
  return data.map((row: any) => toQuickListing({ ...row, profiles: profileMap[row.seller_id] ?? null }));
}

/** Fetch the current user's own listings (all statuses) */
export async function fetchMyQuickListings(sellerId: string): Promise<QuickListing[]> {
  const { data, error } = await supabase
    .from("quick_listings")
    .select("*")
    .eq("seller_id", sellerId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  // Fetch this user's profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,name,year,whatsapp")
    .eq("id", sellerId)
    .single();

  return data.map((row: any) => toQuickListing({ ...row, profiles: profile ?? null }));
}

/** Count how many ACTIVE listings the user currently has */
export async function countActiveListings(sellerId: string): Promise<number> {
  const { count, error } = await supabase
    .from("quick_listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", sellerId)
    .eq("status", "active");

  if (error) throw error;
  return count ?? 0;
}

/** Upload listing images and create the row */
export async function createQuickListing(
  sellerId: string,
  fields: {
    title: string;
    description: string;
    price: number;
    condition: QuickListingCondition;
    category: string;
    pickupLocation: string;
    imageFiles: File[];
  }
): Promise<QuickListing> {
  // Upload images through Cloudinary via the existing edge function
  const uploaded: string[] = [];
  for (const file of fields.imageFiles) {
    const randomSuffix = Math.random().toString(36).substring(7);
    const url = await uploadImage(
      "quick-listing-images",
      `${sellerId}/${Date.now()}-${randomSuffix}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "")}`,
      file
    );
    uploaded.push(url);
  }

  const { data, error } = await supabase
    .from("quick_listings")
    .insert({
      seller_id:       sellerId,
      title:           fields.title.trim(),
      description:     fields.description.trim(),
      price:           fields.price,
      condition:       fields.condition,
      category:        fields.category,
      pickup_location: fields.pickupLocation,
      images:          uploaded,
    })
    .select("*")   // profiles join omitted — joined at fetch time instead
    .single();

  if (error) {
    throw new Error(
      typeof error === "object" && error !== null && "message" in error
        ? String((error as any).message)
        : JSON.stringify(error)
    );
  }
  // Return without profile data; it is loaded when fetchMyQuickListings is called
  return toQuickListing({ ...(data as QuickListingRow), profiles: null });
}

/** Mark a listing as sold */
export async function markListingAsSold(id: string): Promise<void> {
  const { error } = await supabase
    .from("quick_listings")
    .update({ status: "sold" })
    .eq("id", id);
  if (error) throw error;
}

/** Delete (remove) a listing */
export async function deleteQuickListing(id: string): Promise<void> {
  const { error } = await supabase
    .from("quick_listings")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
