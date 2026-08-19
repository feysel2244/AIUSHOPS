import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { toProduct, toShop, type ProductRow, type ShopRow } from "../lib/marketData";
import StarRating from "../components/ui/StarRating";
import Badge from "../components/ui/Badge";
import ProductCard from "../components/cards/ProductCard";
import { useApp } from "../context/AppContext";

type Review = {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  date: string;
  text: string;
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
  };
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, addToCart, openAuthModal, wishlist, toggleWishlist, trackView } = useApp();
  const [product, setProduct] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const [addedMsg, setAddedMsg] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      const { data } = await supabase
        .from("products")
        .select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null)
        .eq("slug", slug)
        .maybeSingle();

      if (!active) return;
      if (!data) {
        setProduct(null);
        setLoading(false);
        return;
      }

      const nextProduct = toProduct(data as ProductRow);
      setProduct(nextProduct);
      setShop(data.shops ? toShop(data.shops as ShopRow) : null);

      const [{ data: relatedRows }, { data: productReviews }] = await Promise.all([
        supabase
          .from("products")
          .select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null)
          .eq("shop_id", data.shop_id)
          .neq("id", data.id)
          .order("created_at", { ascending: false })
          .limit(4),
        supabase
          .from("reviews")
          .select("id,rating,text,created_at,profiles(name,avatar_url)")
          .eq("product_id", data.id)
          .order("created_at", { ascending: false }),
      ]);

      let scopedReviews = productReviews ?? [];
      if (scopedReviews.length === 0) {
        const { data: fallbackReviews } = await supabase
          .from("reviews")
          .select("id,rating,text,created_at,profiles(name,avatar_url)")
          .eq("shop_id", data.shop_id)
          .is("product_id", null)
          .is("service_id", null)
          .order("created_at", { ascending: false });
        scopedReviews = fallbackReviews ?? [];
      }

      if (!active) return;
      setRelated((relatedRows ?? []).map((row) => toProduct(row as ProductRow)));
      setReviews(scopedReviews.map(toReview));
      setLoading(false);
    }

    void loadProduct();
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (product) {
      trackView({
        id: product.id,
        slug: product.slug,
        type: "product",
        name: product.name,
        image: product.images[0],
        price: product.price,
        shopName: product.shopName,
        viewedAt: Date.now(),
      });
      // Fire-and-forget view tracking (never blocks render, never shows errors)
      void supabase.from("listing_views").insert({
        listing_type: "product",
        listing_id: product.id,
        shop_id: product.shopId,
        viewer_id: user?.id ?? null,
      });
    }
  }, [product?.id, trackView]);

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-20 text-center text-stone-500">Loading product...</div>;
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">Box</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Product not found</h2>
        <p className="text-stone-500 mb-4">This listing may have been removed or changed.</p>
        <Link to="/browse" className="px-6 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium">Browse Listings</Link>
      </div>
    );
  }

  const p = product;
  const isWished = wishlist.includes(p.id);
  const isAvailable = p.stock !== "out_of_stock";

  function buildCartItem() {
    return {
      productId: p.id,
      shopId: p.shopId,
      shopSlug: p.shopSlug,
      shopName: p.shopName,
      name: p.name,
      price: p.price,
      image: p.images[0],
      quantity: qty,
      pickupLocation: p.pickupLocation,
    };
  }

  function handleAddToCart() {
    if (!user) { openAuthModal("login"); return; }
    addToCart(buildCartItem());
    setAddedMsg(true);
    setTimeout(() => setAddedMsg(false), 2500);
  }

  function handleBuyNow() {
    if (!user) { openAuthModal("login"); return; }
    addToCart(buildCartItem());
    navigate("/cart?buy=1");
  }

  function handleMessage() {
    if (!user) { openAuthModal("login"); return; }
    if (shop?.seller?.whatsapp) window.open(`https://wa.me/${shop.seller.whatsapp}`, "_blank");
  }

  function stockLabel() {
    if (p.stock === "in_stock") return { text: "In stock", cls: "text-green-600" };
    if (p.stock === "only_few") return { text: `Only ${p.stockCount ?? "few"} left`, cls: "text-amber-600" };
    if (p.stock === "out_of_stock") return { text: "Out of stock", cls: "text-red-600" };
    if (p.stock === "made_to_order") return { text: "Made to order", cls: "text-purple-600" };
    return { text: p.stock, cls: "text-stone-500" };
  }

  const { text: stockText, cls: stockCls } = stockLabel();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 pb-28 md:pb-8">
      <nav className="text-xs text-stone-400 mb-6 flex items-center gap-1.5">
        <Link to="/" className="hover:text-[#1C3270]">Home</Link> /
        <Link to="/browse" className="hover:text-[#1C3270]">Browse</Link> /
        <Link to={`/shop/${p.shopSlug}`} className="hover:text-[#1C3270]">{p.shopName}</Link> /
        <span className="text-stone-600">{p.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div>
          <div className="aspect-[4/3] bg-stone-100 rounded-2xl overflow-hidden mb-3">
            <img src={p.images[activeImg]} alt={p.name} className="w-full h-full object-cover" />
          </div>
          {p.images.length > 1 && (
            <div className="flex gap-2">
              {p.images.map((img: string, i: number) => (
                <button key={img} onClick={() => setActiveImg(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${activeImg === i ? "border-[#1C3270]" : "border-stone-200 hover:border-stone-300"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {p.promoted && <div className="mb-2"><Badge variant="promoted" /></div>}
          <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">{p.category}</span>
          <h1 className="text-2xl font-bold text-stone-900 mt-2 mb-1 leading-tight" style={{ fontFamily: "Lora, serif" }}>{p.name}</h1>
          <div className="flex items-center gap-3 mb-3">
            <StarRating rating={p.rating} reviewCount={p.reviewCount} />
            <span className={`text-sm font-medium ${stockCls}`}>{stockText}</span>
          </div>

          <Link to={`/shop/${p.shopSlug}`} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-200 transition-colors mb-4">
            <img src={p.shopLogo} alt={p.shopName} className="w-9 h-9 rounded-lg object-cover bg-stone-200" />
            <div>
              <div className="font-semibold text-sm text-stone-900">{p.shopName}</div>
              <div className="text-xs text-stone-500 flex items-center gap-1">{p.pickupLocation}</div>
            </div>
            <span className="ml-auto text-xs text-[#1C3270]">View shop</span>
          </Link>

          <div className="flex items-end gap-2 mb-4">
            <span className="text-3xl font-bold text-[#1C3270]">RM {p.price.toFixed(2)}</span>
            {p.stock === "made_to_order" && <span className="text-sm text-stone-400 mb-1">per piece</span>}
          </div>

          {isAvailable && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-stone-600 font-medium">Quantity</span>
              <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-9 h-9 flex items-center justify-center text-stone-600 hover:bg-stone-50 transition-colors text-lg">-</button>
                <span className="w-10 text-center text-sm font-semibold">{qty}</span>
                <button onClick={() => setQty(qty + 1)} className="w-9 h-9 flex items-center justify-center text-stone-600 hover:bg-stone-50 transition-colors text-lg">+</button>
              </div>
            </div>
          )}

          <div className="space-y-2 mb-4">
            <div className="flex gap-3">
              <button onClick={handleBuyNow} disabled={!isAvailable} className="flex-1 py-3 bg-[#44B444] text-white rounded-xl font-semibold hover:bg-[#2E8A2E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {isAvailable ? "Buy Now" : "Out of Stock"}
              </button>
              <button onClick={() => toggleWishlist(p.id)} className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center text-xs transition-colors flex-shrink-0 ${isWished ? "border-red-300 bg-red-50" : "border-stone-200 hover:border-stone-300"}`} aria-label={isWished ? "Remove from wishlist" : "Add to wishlist"}>
                {isWished ? "Saved" : "Save"}
              </button>
            </div>
            <button onClick={handleAddToCart} disabled={!isAvailable} className="w-full py-3 border-2 border-[#1C3270] text-[#1C3270] rounded-xl font-semibold hover:bg-[#1C3270] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {addedMsg ? "Added to cart!" : isAvailable ? "Add to Cart" : "Out of Stock"}
            </button>
          </div>

          <button onClick={handleMessage} className="w-full py-2.5 border-2 border-[#25D366] text-[#25D366] rounded-xl font-semibold hover:bg-[#25D366] hover:text-white transition-colors flex items-center justify-center gap-2 text-sm">
            Message Seller on WhatsApp
          </button>

          <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm text-blue-800">
            <strong>Pickup location:</strong> {p.pickupLocation}. Coordinate timing with the seller via WhatsApp after ordering.
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-8">
        <h2 className="text-xl font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>About this product</h2>
        <p className="text-stone-600 leading-relaxed">{p.description}</p>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 mb-8">
        <h2 className="text-xl font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>Reviews</h2>
        <div className="space-y-4">
          {reviews.length === 0 ? <p className="text-sm text-stone-500">No reviews yet.</p> : reviews.map((r) => (
            <div key={r.id} className="flex gap-3 p-4 bg-stone-50 rounded-xl">
              <img src={r.avatar} alt={r.author} className="w-9 h-9 rounded-full object-cover" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{r.author}</span>
                  <StarRating rating={r.rating} size="sm" />
                  <span className="text-xs text-stone-400">{r.date}</span>
                </div>
                <p className="text-sm text-stone-600 mt-1">{r.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {related.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>More from {p.shopName}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </div>
      )}
    </div>
  );
}
