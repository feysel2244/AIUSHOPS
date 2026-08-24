import { Link, useNavigate } from "react-router-dom";
import StarRating from "../ui/StarRating";
import Badge from "../ui/Badge";
import { useApp } from "../../context/AppContext";

type Service = {
  id: string;
  slug: string;
  shopSlug: string;
  shopName: string;
  shopLogo: string;
  name: string;
  price: number;
  priceType: string;
  image: string;
  category: string;
  pickupLocation: string;
  availability: string;
  description: string;
  promoted: boolean;
  rating: number;
  reviewCount: number;
};

function availLabel(a: string) {
  if (a === "available") {
    return {
      label: "Available now",
      color: "text-green-600",
    };
  }

  if (a === "slots_open") {
    return {
      label: "Slots open this week",
      color: "text-blue-600",
    };
  }

  if (a === "fully_booked") {
    return {
      label: "Fully booked",
      color: "text-red-500",
    };
  }

  return {
    label: a,
    color: "text-stone-500",
  };
}

export default function ServiceCard({
  service,
}: {
  service: Service;
}) {
  const navigate = useNavigate();

  const {
    user,
    openAuthModal,
    wishlist,
    toggleWishlist,
  } = useApp();

  const { label, color } = availLabel(
    service.availability
  );

  const isAvailable =
    service.availability !== "fully_booked";

  const isWished = wishlist.includes(service.id);

  function handleBook(e: React.MouseEvent) {
    e.preventDefault();

    if (!isAvailable) return;
    navigate(`/service/${service.slug}`);
  }

  function handleWishlist(e: React.MouseEvent) {
    e.preventDefault();

    if (!user) {
      openAuthModal("login");
      return;
    }

    toggleWishlist(service.id, "service");
  }

  return (
    <Link
      to={`/service/${service.slug}`}
      className="group flex h-full min-w-0 flex-col bg-white dark:bg-[#112038] rounded-xl border border-stone-100 dark:border-[#1C3058] shadow-sm hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(0,180,198,0.08)] transition-all duration-200 overflow-hidden"
      style={{ borderTop: "3px solid #00B4C6" }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-stone-100 overflow-hidden flex-shrink-0">
        <img
          src={service.image}
          alt={service.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />

        <div className="absolute top-2 left-2">
          <Badge
            variant="service"
            label="Service"
          />
        </div>

        {service.promoted && (
          <div className="absolute top-2 right-2">
            <Badge variant="promoted" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-1 min-w-0 flex-col">
        {/* Service name */}
        <h3 className="font-semibold text-stone-900 text-sm leading-snug line-clamp-2 h-[2.5rem] min-w-0 overflow-hidden group-hover:text-[#1C3270] transition-colors mb-1">
          {service.name}
        </h3>

        {/* Shop */}
        <div className="flex items-center gap-2 mb-2 min-w-0">
          <img
            src={service.shopLogo}
            alt={service.shopName}
            className="w-4 h-4 rounded object-cover bg-stone-100 flex-shrink-0"
          />

          <span className="text-xs text-stone-500 truncate min-w-0">
            {service.shopName}
          </span>
        </div>

        {/* Location */}
        <div className="text-xs text-stone-500 mb-2 flex items-center gap-1 min-w-0">
          <span className="flex-shrink-0">
            📍
          </span>

          <span className="truncate min-w-0">
            {service.pickupLocation}
          </span>
        </div>

        {/* Category */}
        <div className="mb-2 min-w-0">
          <span className="inline-block max-w-full truncate text-xs text-blue-700 font-medium bg-blue-50 px-1.5 py-0.5 rounded-full">
            {service.category}
          </span>
        </div>

        {/* Rating */}
        <div className="flex-shrink-0">
          <StarRating
            rating={service.rating}
            reviewCount={service.reviewCount}
            size="sm"
          />
        </div>

        {/* Bottom section */}
        <div className="mt-auto pt-2">
          <div className="flex items-baseline justify-between gap-1 mb-2 min-w-0">
            <div className="min-w-0 flex items-baseline truncate">
              <span className="font-bold text-[#1C3270] text-base leading-none whitespace-nowrap">
                RM {service.price.toFixed(2)}
              </span>

              <span className="text-[10px] text-stone-400 ml-1 truncate">
                {service.priceType}
              </span>
            </div>

            <span
              className={`text-[10px] leading-none flex-shrink-0 truncate max-w-[45%] ${color}`}
            >
              {label}
            </span>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-1 min-w-0">
            <button
              onClick={handleWishlist}
              className={`w-7 h-7 rounded-lg border flex-shrink-0 flex items-center justify-center text-sm transition-colors ${
                isWished
                  ? "border-red-200 bg-red-50"
                  : "border-stone-200 hover:border-stone-300"
              }`}
              aria-label={
                isWished
                  ? "Remove from wishlist"
                  : "Save"
              }
            >
              {isWished ? "❤️" : "🤍"}
            </button>

            <button
              onClick={handleBook}
              disabled={!isAvailable}
              className="flex-1 min-w-0 py-1.5 rounded-lg text-xs font-semibold transition-all bg-[#44B444] text-white hover:bg-[#2E8A2E] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isAvailable
                ? "Book"
                : "Fully Booked"}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}