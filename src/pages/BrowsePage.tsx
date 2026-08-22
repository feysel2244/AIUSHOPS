import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CAMPUS_LOCATIONS } from "../data/mockData";
import { useCategories } from "../hooks/useCategories";
import ProductCard from "../components/cards/ProductCard";
import ServiceCard from "../components/cards/ServiceCard";
import ShopCard from "../components/cards/ShopCard";
import { supabase } from "../lib/supabase";
import { toProduct, toService, toShop } from "../lib/marketData";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Highest Rated" },
];

const TAB_OPTIONS = ["All", "Products", "Services", "Shops"];

export default function BrowsePage() {
  const { categories } = useCategories();
  const [params] = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const initialCat = params.get("cat") ?? "";

  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);
  const [sort, setSort] = useState("relevance");
  const [tab, setTab] = useState("All");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [openOnly, setOpenOnly] = useState(false);
  const [location, setLocation] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [filteredServices, setFilteredServices] = useState<any[]>([]);
  const [filteredShops, setFilteredShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setCat(params.get("cat") ?? "");
  }, [params]);

  const search = q.toLowerCase();

  useEffect(() => {
    async function loadResults() {
      setLoading(true);
      const productOrder = sort === "price_asc" ? ["price", true] : sort === "price_desc" ? ["price", false] : sort === "rating" ? ["rating", false] : ["created_at", false];
      const serviceOrder = productOrder;
      const shopOrder = sort === "rating" ? ["rating", false] : ["created_at", false];

      let productQuery = supabase.from("products").select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null);
      let serviceQuery = supabase.from("services").select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null);
      let shopQuery = supabase.from("shops").select(`
  *,
  profiles(name,department,year,whatsapp),
  products(id),
  services(id)
`).eq("status", "approved").is("deleted_at", null);

      if (search) {
        productQuery = productQuery.ilike("name", `%${search}%`);
        serviceQuery = serviceQuery.ilike("name", `%${search}%`);
        shopQuery = shopQuery.ilike("name", `%${search}%`);
      }
      if (cat) {
        productQuery = productQuery.eq("category", cat);
        serviceQuery = serviceQuery.ilike("category", `%${cat}%`);
        shopQuery = shopQuery.eq("category", cat);
      }
      if (priceMin) {
        productQuery = productQuery.gte("price", Number(priceMin));
        serviceQuery = serviceQuery.gte("price", Number(priceMin));
      }
      if (priceMax) {
        productQuery = productQuery.lte("price", Number(priceMax));
        serviceQuery = serviceQuery.lte("price", Number(priceMax));
      }
      if (minRating) {
        productQuery = productQuery.gte("rating", minRating);
        serviceQuery = serviceQuery.gte("rating", minRating);
        shopQuery = shopQuery.gte("rating", minRating);
      }
      if (location) {
        shopQuery = shopQuery.eq("pickup_location", location);
      }
      if (openOnly) {
        shopQuery = shopQuery.eq("is_open", true).eq("is_paused", false);
      }

      const [productResult, serviceResult, shopResult] = await Promise.all([
        productQuery.order(productOrder[0] as string, { ascending: productOrder[1] as boolean }),
        serviceQuery.order(serviceOrder[0] as string, { ascending: serviceOrder[1] as boolean }),
        shopQuery.order(shopOrder[0] as string, { ascending: shopOrder[1] as boolean }),
      ]);

      setFilteredProducts((productResult.data ?? []).map(toProduct).filter((p) => !location || p.pickupLocation === location));
      setFilteredServices((serviceResult.data ?? []).map(toService).filter((s) => !location || s.pickupLocation === location));
      setFilteredShops((shopResult.data ?? []).map(toShop));
      setLoading(false);
    }
    void loadResults();
  }, [search, cat, sort, priceMin, priceMax, minRating, location, openOnly]);

  const totalCount =
    (tab === "All" ? filteredProducts.length + filteredServices.length + filteredShops.length :
     tab === "Products" ? filteredProducts.length :
     tab === "Services" ? filteredServices.length :
     filteredShops.length);

  function resetFilters() {
    setQ(""); setCat(""); setPriceMin(""); setPriceMax(""); setMinRating(0); setOpenOnly(false); setLocation("");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-stone-900 dark:text-[#E2EAF6]" style={{ fontFamily: "Lora, serif" }}>
          {cat ? cat : q ? `Results for "${q}"` : "Browse Marketplace"}
        </h1>
        <p className="text-stone-500 dark:text-[#6888A8] mt-1">{totalCount} results</p>
      </div>

      {/* Search bar */}
      <div className="flex flex-col gap-2 mb-6">
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products, services, shops..."
            className="flex-1 h-10 px-4 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6] dark:placeholder:text-[#4E6A88] min-w-0"
          />
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`h-10 px-3 rounded-lg text-sm font-medium border transition-colors flex items-center gap-1.5 flex-shrink-0 ${filtersOpen ? "bg-[#1C3270] text-white border-[#1C3270]" : "bg-white dark:bg-[#0E1A2E] border-stone-200 dark:border-[#1C3058] text-stone-700 dark:text-[#A8C0D8] hover:border-stone-300 dark:hover:border-[#2A4A6A]"}`}
          >
            ⚙️ <span className="hidden sm:inline">Filters</span>
          </button>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="w-full h-10 px-3 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-white dark:bg-[#0E1A2E] text-stone-700 dark:text-[#A8C0D8] md:w-auto md:self-start"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Filters panel */}
      {filtersOpen && (
        <div className="bg-white dark:bg-[#112038] border border-stone-200 dark:border-[#1C3058] rounded-xl p-4 mb-6 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-[#6888A8] mb-1.5">Category</label>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="w-full border border-stone-200 dark:border-[#1C3058] rounded-lg px-2 py-2 text-sm focus:outline-none bg-white dark:bg-[#0E1A2E] dark:text-[#A8C0D8]">
                <option value="">All categories</option>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-[#6888A8] mb-1.5">Min Rating</label>
              <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))} className="w-full border border-stone-200 dark:border-[#1C3058] rounded-lg px-2 py-2 text-sm focus:outline-none bg-white dark:bg-[#0E1A2E] dark:text-[#A8C0D8]">
                <option value={0}>Any rating</option>
                {[3, 3.5, 4, 4.5].map((r) => <option key={r} value={r}>★ {r}+</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-[#6888A8] mb-1.5">Pickup Location</label>
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border border-stone-200 dark:border-[#1C3058] rounded-lg px-2 py-2 text-sm focus:outline-none bg-white dark:bg-[#0E1A2E] dark:text-[#A8C0D8]">
                <option value="">Any location</option>
                {CAMPUS_LOCATIONS.map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-600 dark:text-[#6888A8] mb-1.5">Price Range (RM)</label>
              <div className="flex items-center gap-2">
                <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="Min" className="w-full border border-stone-200 dark:border-[#1C3058] rounded-lg px-2 py-2 text-sm focus:outline-none bg-white dark:bg-[#0E1A2E] dark:text-[#A8C0D8] dark:placeholder:text-[#4E6A88]" type="number" />
                <span className="text-stone-400 flex-shrink-0">–</span>
                <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="Max" className="w-full border border-stone-200 dark:border-[#1C3058] rounded-lg px-2 py-2 text-sm focus:outline-none bg-white dark:bg-[#0E1A2E] dark:text-[#A8C0D8] dark:placeholder:text-[#4E6A88]" type="number" />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-stone-100 dark:border-[#1C3058]">
            <div className="flex items-center gap-2">
              <input type="checkbox" id="openOnly" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="accent-[#1C3270]" />
              <label htmlFor="openOnly" className="text-sm text-stone-600 dark:text-[#A8C0D8] cursor-pointer">Open now only</label>
            </div>
            <button onClick={resetFilters} className="text-sm text-[#1C3270] dark:text-[#00B4C6] hover:text-[#0F1F4A] dark:hover:text-[#44B444] font-medium">Reset all</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-stone-100 dark:bg-[#0E1A2E] rounded-lg p-1 w-full sm:w-fit">
        {TAB_OPTIONS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === t ? "bg-white dark:bg-[#1C3270] text-[#1C3270] dark:text-white shadow-sm" : "text-stone-500 dark:text-[#4E6A88] hover:text-stone-700 dark:hover:text-[#A8C0D8]"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center py-20 text-stone-400">Loading results...</div>
      ) : totalCount === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <h3 className="text-xl font-bold text-stone-900 dark:text-[#E2EAF6] mb-2" style={{ fontFamily: "Lora, serif" }}>No results found</h3>
          <p className="text-stone-500 dark:text-[#6888A8] mb-4">Try adjusting your filters or search for something else.</p>
          <button onClick={resetFilters} className="px-6 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium hover:bg-[#0F1F4A]">Clear filters</button>
        </div>
      ) : (
        <div className="space-y-10">
          {(tab === "All" || tab === "Shops") && filteredShops.length > 0 && (
            <div>
              {tab === "All" && <h3 className="font-bold text-stone-700 dark:text-[#6888A8] text-sm uppercase tracking-wide mb-3">Shops</h3>}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredShops.map((shop) => <ShopCard key={shop.id} shop={shop} />)}
              </div>
            </div>
          )}
          {(tab === "All" || tab === "Products") && filteredProducts.length > 0 && (
            <div>
              {tab === "All" && <h3 className="font-bold text-stone-700 dark:text-[#6888A8] text-sm uppercase tracking-wide mb-3">Products</h3>}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredProducts.map((p) => <ProductCard key={p.id} product={p as any} />)}
              </div>
            </div>
          )}
          {(tab === "All" || tab === "Services") && filteredServices.length > 0 && (
            <div>
              {tab === "All" && <h3 className="font-bold text-stone-700 dark:text-[#6888A8] text-sm uppercase tracking-wide mb-3">Services</h3>}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {filteredServices.map((s) => <ServiceCard key={s.id} service={s as any} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
