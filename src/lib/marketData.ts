export type ShopRow = {
  id: string;
  owner_id?: string;
  slug: string;
  name: string;
  category: string;
  bio?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  pickup_location?: string | null;
  is_open?: boolean | null;
  is_paused?: boolean | null;
  status?: string | null;
  rating?: number | null;
  review_count?: number | null;
  created_at?: string | null;
  profiles?: {
    name?: string | null;
    department?: string | null;
    year?: string | null;
    whatsapp?: string | null;
  } | null;
};

export type ProductRow = {
  id: string;
  shop_id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  category: string;
  stock_status?: string | null;
  stock_count?: number | null;
  images?: string[] | null;
  is_promoted?: boolean | null;
  promoted_until?: string | null;
  rating?: number | null;
  review_count?: number | null;
  created_at?: string | null;
  shops?: ShopRow | null;
};

export type ServiceRow = {
  id: string;
  shop_id: string;
  slug: string;
  name: string;
  description?: string | null;
  what_included?: string | null;
  price: number;
  price_type?: string | null;
  turnaround?: string | null;
  category: string;
  availability?: string | null;
  image?: string | null;
  is_promoted?: boolean | null;
  promoted_until?: string | null;
  rating?: number | null;
  review_count?: number | null;
  created_at?: string | null;
  shops?: ShopRow | null;
};

const fallbackImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&auto=format";
const fallbackLogo = "https://images.unsplash.com/photo-1504386106331-3e4e71712b38?w=80&h=80&fit=crop&auto=format";

export function normalizeRating(value?: number | string | null) {
  const rating = Number(value ?? 0);
  if (!Number.isFinite(rating) || rating <= 0) return 0;
  if (rating > 5 && rating <= 10) return Number((rating / 2).toFixed(1));
  return Math.min(5, rating);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function toShop(row: ShopRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    logo: row.logo_url || fallbackLogo,
    banner: row.banner_url || fallbackImage,
    tagline: row.bio || "Student-run campus shop",
    pickupLocation: row.pickup_location || "Campus",
    rating: normalizeRating(row.rating),
    reviewCount: Number(row.review_count ?? 0),
    isOpen: Boolean(row.is_open ?? true) && !row.is_paused,
    listingCount: 0,
    rank: null,
    seller: {
      name: row.profiles?.name || "AIU Seller",
      department: row.profiles?.department || "",
      year: row.profiles?.year || "",
      whatsapp: row.profiles?.whatsapp || "",
    },
    description: row.bio || "Student-run campus shop",
    promoted: false,
  };
}

export function toProduct(row: ProductRow) {
  const shop = row.shops ? toShop(row.shops) : null;
  return {
    id: row.id,
    slug: row.slug,
    shopId: row.shop_id,
    shopSlug: shop?.slug || "",
    shopName: shop?.name || "AIU Shop",
    shopLogo: shop?.logo || fallbackLogo,
    name: row.name,
    price: Number(row.price ?? 0),
    images: row.images?.length ? row.images : [fallbackImage],
    category: row.category,
    pickupLocation: shop?.pickupLocation || "Campus",
    stock: row.stock_status || "in_stock",
    stockCount: row.stock_count ?? undefined,
    description: row.description || "",
    promoted: Boolean(row.is_promoted),
    rating: normalizeRating(row.rating ?? shop?.rating),
    reviewCount: Number(row.review_count ?? 0),
    type: "product" as const,
  };
}

export function toService(row: ServiceRow) {
  const shop = row.shops ? toShop(row.shops) : null;
  return {
    id: row.id,
    slug: row.slug,
    shopId: row.shop_id,
    shopSlug: shop?.slug || "",
    shopName: shop?.name || "AIU Shop",
    shopLogo: shop?.logo || fallbackLogo,
    name: row.name,
    price: Number(row.price ?? 0),
    priceType: row.price_type || "",
    image: row.image || fallbackImage,
    category: row.category,
    pickupLocation: shop?.pickupLocation || "Campus",
    availability: row.availability || "available",
    description: row.description || "",
    turnaround: row.turnaround || "",
    what_included: row.what_included || "",
    promoted: Boolean(row.is_promoted),
    rating: normalizeRating(row.rating ?? shop?.rating),
    reviewCount: Number(row.review_count ?? 0),
    type: "service" as const,
  };
}

export function formatRelativeTime(value?: string | null) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
