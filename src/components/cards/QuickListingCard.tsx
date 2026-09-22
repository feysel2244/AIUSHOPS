import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { cloudinaryOptimize } from "../../lib/cloudinary";
import LazyImage from "../ui/LazyImage";
import {
  type QuickListing,
  CONDITION_COLORS,
  markListingAsSold,
} from "../../lib/quickListings";

export default function QuickListingCard({
  listing,
  isOwner = false,
  onStatusChange,
}: {
  listing: QuickListing;
  isOwner?: boolean;
  onStatusChange?: () => void;
}) {
  const { user, addToCart, openAuthModal } = useApp();
  const navigate = useNavigate();
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (listing.images.length <= 1) return;
    const interval = setInterval(() => {
      setImgIdx(p => (p < listing.images.length - 1 ? p + 1 : 0));
    }, 1500);
    return () => clearInterval(interval);
  }, [listing.images.length]);

  function handleAddToCart(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { openAuthModal("login"); return; }
    addToCart({
      productId:      listing.id,
      shopId:         listing.sellerId,
      shopSlug:       `quick-${listing.sellerId}`,
      shopName:       listing.sellerName,
      name:           listing.title,
      price:          listing.price,
      image:          listing.images[0] ?? "",
      quantity:       1,
      pickupLocation: listing.pickupLocation,
      quickListingId: listing.id,
    });
  }

  function handleBuyNow(e: React.MouseEvent) {
    e.preventDefault();
    if (!user) { openAuthModal("login"); return; }
    addToCart({
      productId:      listing.id,
      shopId:         listing.sellerId,
      shopSlug:       `quick-${listing.sellerId}`,
      shopName:       listing.sellerName,
      name:           listing.title,
      price:          listing.price,
      image:          listing.images[0] ?? "",
      quantity:       1,
      pickupLocation: listing.pickupLocation,
      quickListingId: listing.id,
    });
    navigate("/cart?buy=1");
  }

  async function handleMarkSold(e: React.MouseEvent) {
    e.preventDefault();
    await markListingAsSold(listing.id);
    onStatusChange?.();
  }

  const isSold    = listing.status === "sold";
  const isExpired = listing.status === "expired";
  const condCls   = CONDITION_COLORS[listing.condition] ?? "bg-stone-50 text-stone-600 border-stone-200";

  return (
    <div className="group flex h-full min-w-0 flex-col bg-white dark:bg-[#112038] rounded-xl border border-stone-100 dark:border-[#1C3058] shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden"
         style={{ borderTop: "3px solid #00B4C6" }}>

      {/* Image */}
      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden flex-shrink-0 group/img">
        <LazyImage
          src={cloudinaryOptimize(listing.images[imgIdx] ?? listing.images[0], 400)}
          alt={listing.title}
          loading="lazy"
          decoding="async"
          className={`w-full h-full object-cover transition-transform duration-300 ${isSold || isExpired ? "opacity-50 grayscale" : "group-hover/img:scale-105"}`}
        />
        
        {/* Slider Controls */}
        {listing.images.length > 1 && (
          <>
            <button 
              onClick={(e) => { e.preventDefault(); setImgIdx(p => p > 0 ? p - 1 : listing.images.length - 1); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-white shadow"
            >
              <svg className="w-4 h-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <button 
              onClick={(e) => { e.preventDefault(); setImgIdx(p => p < listing.images.length - 1 ? p + 1 : 0); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-white/80 rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-white shadow"
            >
              <svg className="w-4 h-4 text-stone-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
              {listing.images.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === imgIdx ? "bg-white" : "bg-white/50"}`} />
              ))}
            </div>
          </>
        )}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#00B4C6] text-white px-2 py-0.5 rounded-full shadow">
            Student Listing
          </span>
        </div>
        <div className="absolute top-2 right-2">
          <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${condCls}`}>
            {listing.conditionLabel}
          </span>
        </div>
        {(isSold || isExpired) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="bg-stone-700 text-white text-xs font-bold px-3 py-1 rounded-full shadow">
              {isSold ? "Sold" : "Expired"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-1 min-w-0 flex-col">
        <h3 className="font-semibold text-stone-900 dark:text-[#E2EAF6] text-sm leading-snug line-clamp-2 h-[2.5rem] overflow-hidden mb-1 group-hover:text-[#1C3270] transition-colors">
          {listing.title}
        </h3>
        <div className="text-xs text-stone-500 dark:text-[#6888A8] mb-1 truncate">
          {listing.sellerName}{listing.sellerYear ? ` · Year ${listing.sellerYear}` : ""}
        </div>
        <div className="text-xs text-stone-500 dark:text-[#6888A8] mb-2 truncate">
          {listing.pickupLocation}
        </div>

        <div className="mt-auto pt-2">
          <span className="font-bold text-[#1C3270] dark:text-[#A8C0D8] text-base leading-none block mb-2">
            RM {listing.price.toFixed(2)}
          </span>

          {isOwner ? (
            <div className="flex gap-1">
              {listing.status === "active" && (
                <button
                  onClick={(e) => void handleMarkSold(e)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 border-[#44B444] text-[#44B444] hover:bg-[#44B444] hover:text-white transition-all"
                >
                  Mark Sold
                </button>
              )}
            </div>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={handleAddToCart}
                disabled={isSold || isExpired}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 border-[#1C3270] text-[#1C3270] hover:bg-[#1C3270] hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cart
              </button>
              <button
                onClick={handleBuyNow}
                disabled={isSold || isExpired}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[#44B444] text-white hover:bg-[#2E8A2E] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Buy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
