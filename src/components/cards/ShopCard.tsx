import { Link } from "react-router-dom";
import StarRating from "../ui/StarRating";
import Badge from "../ui/Badge";

type Shop = {
  id: string;
  slug: string;
  name: string;
  category: string;
  logo: string;
  tagline: string;
  pickupLocation: string;
  rating: number;
  reviewCount: number;
  isOpen: boolean;
  listingCount: number;
  rank?: number | null;
  promoted?: boolean;
};

export default function ShopCard({ shop }: { shop: Shop }) {
  return (
    <Link
      to={`/shop/${shop.slug}`}
className="group block w-full min-w-0 bg-white dark:bg-[#112038] rounded-xl border border-stone-100 dark:border-[#1C3058] shadow-sm hover:shadow-md dark:hover:shadow-[0_4px_20px_rgba(28,50,112,0.2)] hover:border-[#1C3270]/30 dark:hover:border-[#00B4C6]/30 transition-all duration-200 overflow-hidden"    >
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <div className="relative flex-shrink-0">
            <img
              src={shop.logo}
              alt={`${shop.name} logo`}
              className="w-12 h-12 rounded-xl object-cover bg-stone-100"
            />
            {shop.rank && shop.rank <= 3 && (
              <span className="absolute -top-1.5 -right-1.5">
                <Badge variant="rank" rank={shop.rank} />
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-stone-900 text-sm leading-tight group-hover:text-[#1C3270] transition-colors line-clamp-1 mb-0.5">
              {shop.name}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <span className="text-xs text-stone-500">{shop.category}</span>
              {shop.promoted && <Badge variant="promoted" />}
            </div>
            <StarRating rating={shop.rating} reviewCount={shop.reviewCount} size="sm" />
          </div>
        </div>

<p className="text-xs text-stone-500 leading-snug truncate w-full">
  {shop.tagline}
</p>   <div className="flex items-center justify-between text-xs text-stone-500 gap-1">
          <span className="flex items-center gap-1 min-w-0">
            <span className="flex-shrink-0">📍</span>
            <span className="truncate">{shop.pickupLocation}</span>
          </span>
          <Badge variant={shop.isOpen ? "open" : "closed"} />
        </div>

        <div className="text-xs text-stone-400">{shop.listingCount} listings</div>
      </div>
    </Link>
  );
}
