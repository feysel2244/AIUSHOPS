import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toProduct, toService, toShop, type ProductRow, type ServiceRow, type ShopRow } from "../lib/marketData";
import ProductCard from "../components/cards/ProductCard";
import ServiceCard from "../components/cards/ServiceCard";
import StarRating from "../components/ui/StarRating";
import Badge from "../components/ui/Badge";
import { useApp } from "../context/AppContext";

type Review = {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  text: string;
  product: string;
};

const avatarFallback = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format";

function toReview(row: any): Review {
  return {
    id: row.id,
    author: row.profiles?.name || "AIU Student",
    avatar: row.profiles?.avatar_url || avatarFallback,
    rating: Number(row.rating || 0),
    date: row.created_at ? new Date(row.created_at).toLocaleDateString("en-MY") : "",
    text: row.text || "",
    product: row.products?.name || row.services?.name || "Shop order",
  };
}

export default function ShopPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, openAuthModal, trackView, favouriteShops, toggleFavouriteShop } = useApp();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("All");
  const [sort, setSort] = useState("default");

  useEffect(() => {
    let active = true;

    async function loadShop() {
      setLoading(true);
      const { data: shopRow } = await supabase
        .from("shops")
        .select("*,profiles(name,department,year,whatsapp)")
        .eq("slug", slug)
        .eq("status", "approved")
        .is("deleted_at", null)
        .maybeSingle();

      if (!active) return;
      if (!shopRow) {
        setShop(null);
        setLoading(false);
        return;
      }

      const [{ data: productRows }, { data: serviceRows }, { data: reviewRows }] = await Promise.all([
        supabase
          .from("products")
          .select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null)
          .eq("shop_id", shopRow.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("services")
          .select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null)
          .eq("shop_id", shopRow.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("reviews")
          .select("id,rating,text,created_at,profiles(name,avatar_url),products(name),services(name)")
          .eq("shop_id", shopRow.id)
          .order("created_at", { ascending: false }),
      ]);

      if (!active) return;
      setShop(toShop(shopRow as ShopRow));
      setProducts((productRows ?? []).map((row) => toProduct(row as ProductRow)));
      setServices((serviceRows ?? []).map((row) => toService(row as ServiceRow)));
      setReviews((reviewRows ?? []).map(toReview));
      setLoading(false);
    }

    void loadShop();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (shop) {
      trackView({
        id: shop.id,
        slug: shop.slug,
        type: "shop",
        name: shop.name,
        image: shop.logo,
        viewedAt: Date.now(),
      });
    }
  }, [shop?.id, trackView]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-stone-500">Loading shop...</div>;
  }

  if (!shop) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">Shop</div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Shop not found</h2>
        <p className="text-stone-500 mb-4">This shop may have moved or been removed.</p>
        <Link to="/browse" className="px-6 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium hover:bg-[#0F1F4A]">Browse All Shops</Link>
      </div>
    );
  }

  function sortItems<T extends { price: number; rating: number }>(items: T[]) {
    if (sort === "price_asc") return [...items].sort((a, b) => a.price - b.price);
    if (sort === "price_desc") return [...items].sort((a, b) => b.price - a.price);
    if (sort === "rating") return [...items].sort((a, b) => b.rating - a.rating);
    return items;
  }

  const visibleProducts = tab === "Services" ? [] : sortItems(products);
  const visibleServices = tab === "Products" ? [] : sortItems(services);
  const followed = favouriteShops.includes(shop.id);
  const ratingDist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => Math.round(r.rating) === star).length;
    return { star, count, pct: reviews.length ? (count / reviews.length) * 100 : 0 };
  });

  function handleFollow() {
    if (!user) { openAuthModal("login"); return; }
    toggleFavouriteShop(shop.id);
  }

  function handleMessage() {
    if (!user) { openAuthModal("login"); return; }
    if (shop.seller.whatsapp) window.open(`https://wa.me/${shop.seller.whatsapp}`, "_blank");
  }

  return (
    <div>
      <div className="relative h-48 md:h-64 bg-stone-200 overflow-hidden">
        <img src={shop.banner} alt={`${shop.name} banner`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4">
        <div className="relative -mt-10 mb-6">
          <div className="flex items-start justify-between gap-3">
            <img src={shop.logo} alt={`${shop.name} logo`} className="w-20 h-20 rounded-xl border-4 border-white shadow-md object-cover bg-white flex-shrink-0" />
            <div className="flex items-center gap-2 pt-12">
              <button onClick={handleFollow} className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${followed ? "border-[#1C3270] text-[#1C3270] bg-[#1C3270]/5" : "border-stone-200 text-stone-700 hover:border-stone-300 bg-white"}`}>
                {followed ? "Following" : "Follow"}
              </button>
              <button onClick={handleMessage} className="px-3 py-2 rounded-lg text-sm font-semibold bg-[#25D366] text-white hover:bg-[#1ebe5d] transition-colors flex items-center gap-1.5 whitespace-nowrap">
                <span className="hidden sm:inline">Message Seller</span>
                <span className="sm:hidden">Message</span>
              </button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl md:text-2xl font-bold text-stone-900 leading-tight" style={{ fontFamily: "Lora, serif" }}>{shop.name}</h1>
              <Badge variant={shop.isOpen ? "open" : "closed"} />
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{shop.category}</span>
              <span className="flex items-center gap-1 text-sm text-stone-500">{shop.pickupLocation}</span>
              <StarRating rating={shop.rating} reviewCount={shop.reviewCount} size="sm" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-100 p-4 mb-6">
          <p className="text-stone-600 text-sm leading-relaxed">{shop.description}</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
            {["All", "Products", "Services"].map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white text-[#1C3270] shadow-sm" : "text-stone-500 hover:text-stone-700"}`}>
                {t}
                {t === "Products" && <span className="ml-1 text-xs text-stone-400">({products.length})</span>}
                {t === "Services" && <span className="ml-1 text-xs text-stone-400">({services.length})</span>}
              </button>
            ))}
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="w-full sm:w-auto h-9 px-3 border border-stone-200 rounded-lg text-sm text-stone-600 focus:outline-none focus:border-[#1C3270] bg-white">
            <option value="default">Default order</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {visibleProducts.length === 0 && visibleServices.length === 0 ? (
          <div className="text-center py-16"><p className="text-stone-500">No listings in this category yet.</p></div>
        ) : (
          <div className="space-y-8 mb-12">
            {visibleProducts.length > 0 && (
              <div>
                {tab === "All" && <h3 className="font-bold text-stone-700 text-sm uppercase tracking-wide mb-3">Products</h3>}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {visibleProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              </div>
            )}
            {visibleServices.length > 0 && (
              <div>
                {tab === "All" && <h3 className="font-bold text-stone-700 text-sm uppercase tracking-wide mb-3">Services</h3>}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {visibleServices.map((s) => <ServiceCard key={s.id} service={s} />)}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-8">
          <h2 className="text-xl font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>Customer Reviews</h2>
          <div className="flex flex-col sm:flex-row gap-6 mb-6">
            <div className="text-center flex-shrink-0">
              <div className="text-4xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>{shop.rating}</div>
              <StarRating rating={shop.rating} size="md" />
              <div className="text-xs text-stone-400 mt-1">{shop.reviewCount} reviews</div>
            </div>
            <div className="flex-1 space-y-1.5">
              {ratingDist.map(({ star, pct }) => (
                <div key={star} className="flex items-center gap-2 text-xs text-stone-500">
                  <span className="w-4 flex-shrink-0">{star} star</span>
                  <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: "#44B444" }} />
                  </div>
                  <span className="w-6 text-right flex-shrink-0">{Math.round(pct)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            {reviews.length === 0 ? <p className="text-sm text-stone-500">No reviews yet.</p> : reviews.map((r) => (
              <div key={r.id} className="flex gap-3 p-4 bg-stone-50 rounded-xl">
                <img src={r.avatar} alt={r.author} className="w-9 h-9 rounded-full object-cover bg-stone-200 flex-shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm text-stone-900">{r.author}</span>
                    <StarRating rating={r.rating} size="sm" />
                    <span className="text-xs text-stone-400">{r.date}</span>
                  </div>
                  <p className="text-sm text-stone-600">{r.text}</p>
                  <p className="text-xs text-stone-400 mt-1">Reviewed: {r.product}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-100 p-5 mb-8">
          <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>About the Seller</h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1C3270] text-white flex items-center justify-center font-bold">{shop.seller.name.charAt(0)}</div>
            <div>
              <div className="font-semibold text-stone-900 text-sm">{shop.seller.name}</div>
              <div className="text-xs text-stone-500">{shop.seller.department} - {shop.seller.year}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
