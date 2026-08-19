import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import StarRating from "../ui/StarRating";
import Badge from "../ui/Badge";
import { useApp } from "../../context/AppContext";

type Product = {
  id: string;
  slug: string;
  shopId: string;
  shopSlug: string;
  shopName: string;
  shopLogo: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  pickupLocation: string;
  stock: string;
  stockCount?: number;
  description: string;
  promoted: boolean;
  rating: number;
  reviewCount: number;
};

function stockLabel(stock: string, count?: number) {
  if (stock === "in_stock") return { label: "In stock", color: "text-green-600" };
  if (stock === "only_few") return { label: `Only ${count ?? "few"} left`, color: "text-amber-600" };
  if (stock === "out_of_stock") return { label: "Out of stock", color: "text-red-600" };
  if (stock === "made_to_order") return { label: "Made to order", color: "text-purple-600" };
  return { label: stock, color: "text-stone-500" };
}

export default function ProductCard({ product }: { product: Product }) {
  const { user, addToCart, openAuthModal, wishlist, toggleWishlist } = useApp();
  const { label, color } = stockLabel(product.stock, product.stockCount);
  const [added, setAdded] = useState(false);
  const isWished = wishlist.includes(product.id);
  const navigate = useNavigate();

  function cartItem() {
    return {
      productId: product.id,
      shopId: product.shopId,
      shopSlug: product.shopSlug,
      shopName: product.shopName,
      name: product.name,
      price: product.price,
      image: product.images[0],
      quantity: 1,
      pickupLocation: product.pickupLocation,
    };
  }

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { openAuthModal("login"); return; }
    addToCart(cartItem());
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { openAuthModal("login"); return; }
    addToCart(cartItem());
    navigate("/cart?buy=1");
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { openAuthModal("login"); return; }
    toggleWishlist(product.id);
  }

  const isAvailable = product.stock !== "out_of_stock";

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group block bg-white dark:bg-[#112038] rounded-xl border border-stone-100 dark:border-[#1C3058] shadow-sm hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,180,198,0.08)] hover:border-[#44B444]/40 dark:hover:border-[#00B4C6]/30 transition-all duration-200 overflow-hidden"
    >
      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {product.promoted && (
          <div className="absolute top-2 left-2">
            <Badge variant="promoted" />
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-stone-900 text-sm leading-snug line-clamp-2 group-hover:text-[#1C3270] transition-colors">
            {product.name}
          </h3>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <img src={product.shopLogo} alt={product.shopName} className="w-4 h-4 rounded object-cover bg-stone-100" />
          <span className="text-xs text-stone-500 line-clamp-1">{product.shopName}</span>
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs">📍</span>
          <span className="text-xs text-stone-500 line-clamp-1">{product.pickupLocation}</span>
        </div>

        <StarRating rating={product.rating} reviewCount={product.reviewCount} size="sm" />

        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-1 mb-2">
            <span className="font-bold text-[#1C3270] text-base leading-none">RM {product.price.toFixed(2)}</span>
            <span className={`text-[10px] leading-none ${color}`}>{label}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleWishlist}
              className={`w-7 h-7 rounded-lg border flex-shrink-0 flex items-center justify-center text-sm transition-colors ${isWished ? "border-red-200 bg-red-50" : "border-stone-200 hover:border-stone-300"}`}
              aria-label={isWished ? "Remove from wishlist" : "Save"}
            >
              {isWished ? "❤️" : "🤍"}
            </button>
            <button
              onClick={handleAddToCart}
              disabled={!isAvailable}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed border-2 ${added ? "border-green-500 bg-green-50 text-green-700" : "border-[#1C3270] text-[#1C3270] hover:bg-[#1C3270] hover:text-white"}`}
            >
              {added ? "✓" : "Cart"}
            </button>
            <button
              onClick={handleBuyNow}
              disabled={!isAvailable}
              className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 bg-[#44B444] text-white hover:bg-[#2E8A2E] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Buy
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
