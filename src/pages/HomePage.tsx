import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import ShopCard from "../components/cards/ShopCard";
import { useCategories } from "../hooks/useCategories";
import ProductCard from "../components/cards/ProductCard";
import ServiceCard from "../components/cards/ServiceCard";
import SkeletonCard from "../components/ui/SkeletonCard";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { toProduct, toService, toShop } from "../lib/marketData";

// ── helpers ──────────────────────────────────────────────────────────────────

function SectionHeader({
  title,
  subtitle,
  linkTo,
  linkLabel,
}: {
  title: string;
  subtitle?: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <h2 className="text-xl md:text-2xl font-bold text-stone-900 dark:text-[#E2EAF6] leading-tight" style={{ fontFamily: "Lora, serif" }}>
          {title}
        </h2>
        <span className="section-rule" />
        {subtitle && <p className="text-stone-500 dark:text-[#6888A8] text-sm mt-2">{subtitle}</p>}
      </div>
      {linkTo && (
        <Link
          to={linkTo}
          className="text-sm font-semibold transition-colors flex items-center gap-1 flex-shrink-0 mt-1 text-[#1C3270] dark:text-[#00B4C6] hover:opacity-80"
        >
          {linkLabel ?? "See all"} →
        </Link>
      )}
    </div>
  );
}

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden -mx-4 md:-mx-0">
      <div className="hide-scrollbar flex gap-4 overflow-x-auto pb-3 px-4 md:px-0">
        {children}
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { openAuthModal, user, recentlyViewed, favouriteShops } = useApp();
  const { categories } = useCategories();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [promotedListings, setPromotedListings] = useState<any[]>([]);
  const [favouriteShopsList, setFavouriteShopsList] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadHome() {
      setLoading(true);
      const now = new Date().toISOString();
      const [shopResult, productResult, serviceResult, promotedProductResult, promotedServiceResult] = await Promise.all([
        supabase.from("shops").select(`
  *,
  profiles(name,department,year,whatsapp),
  products(id),
  services(id)
`).eq("status", "approved").is("deleted_at", null).order("rating", { ascending: false }).limit(6),
        supabase.from("products").select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null).order("created_at", { ascending: false }).limit(6),
        supabase.from("services").select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null).order("created_at", { ascending: false }).limit(6),
        supabase.from("products").select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null).eq("is_promoted", true).gt("promoted_until", now).limit(4),
        supabase.from("services").select("*,shops!inner(*,profiles(name,department,year,whatsapp))").is("shops.deleted_at", null).eq("is_promoted", true).gt("promoted_until", now).limit(4),
      ]);

      setShops((shopResult.data ?? []).map(toShop));
      setProducts((productResult.data ?? []).map(toProduct));
      setServices((serviceResult.data ?? []).map(toService));
      setPromotedListings([
        ...(promotedProductResult.data ?? []).map(toProduct),
        ...(promotedServiceResult.data ?? []).map(toService),
      ].slice(0, 4));
      setLoading(false);
    }
    void loadHome();
  }, []);

  useEffect(() => {
    async function loadFavouriteShops() {
      if (favouriteShops.length === 0) {
        setFavouriteShopsList([]);
        return;
      }
      const { data } = await supabase
        .from("shops")
        .select(`
  *,
  profiles(name,department,year,whatsapp),
  products(id),
  services(id)
`)
        .in("id", favouriteShops)
        .eq("status", "approved").is("deleted_at", null);
      setFavouriteShopsList((data ?? []).map(toShop));
    }
    void loadFavouriteShops();
  }, [favouriteShops]);

  function handleHeroSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) navigate(`/browse?q=${encodeURIComponent(search.trim())}`);
  }

  const topRatedShops = [...shops]
    .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
    .slice(0, 6);

  const allListings = [...products, ...services];
  const newArrivals = allListings.slice(0, 6);
  const promoted = promotedListings;

  return (
    <div>
      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden"
        style={{
          background: "linear-gradient(140deg, #0F1F4A 0%, #1C3270 45%, #00607A 100%)",
          minHeight: 360,
        }}
      >
        {/* Dot grid texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,180,198,0.2) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-4 pt-14 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-white/80 text-xs mb-5 backdrop-blur-sm">
            <span style={{ color: "#44B444" }}>✦</span>
            AIU's official student to student marketplace
          </div>

          <h1
            className="text-4xl md:text-5xl font-bold text-white leading-tight mb-4"
            style={{ fontFamily: "Lora, serif" }}
          >
            Shop, Sell &amp; Thrive
            <br />
            <span style={{ color: "#A8DCA8" }}>on Campus</span>
          </h1>

          <p className="text-white/70 text-base md:text-lg mb-8 max-w-lg mx-auto leading-relaxed">
            Discover student run shops   food, fashion, tutoring, printing &amp; more.
            Every AIU student can open a shop for free.
          </p>

          <form onSubmit={handleHeroSearch} className="flex max-w-xl mx-auto gap-2 shadow-2xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Try: nasi lemak, maths tutoring, printed poster…"
              className="flex-1 h-12 px-4 rounded-xl text-sm focus:outline-none text-stone-900 bg-white"
            />
            <button
              type="submit"
              className="h-12 px-6 rounded-xl font-semibold text-sm text-white flex-shrink-0 transition-colors"
              style={{ background: "#44B444" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#2E8A2E")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#44B444")}
            >
              Search
            </button>
          </form>

          <div className="flex items-center justify-center gap-6 mt-5 text-white/50 text-xs flex-wrap">
            {[
              `${shops.length} shops live`,
              `${products.length + services.length}+ listings`,
              "TnG · FPX · Card payments",
            ].map((t) => (
              <span key={t} className="flex items-center gap-1">
                <span style={{ color: "#44B444" }}>✓</span> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Wave transition */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }} className="[.dark_&]:hidden">
            <path d="M0 48 C480 0 960 0 1440 48 L1440 48 L0 48 Z" fill="#F4F7FB" />
          </svg>
          <svg viewBox="0 0 1440 48" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }} className="hidden [.dark_&]:block">
            <path d="M0 48 C480 0 960 0 1440 48 L1440 48 L0 48 Z" fill="#0B1628" />
          </svg>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-14">

        {/* Categories */}
        <section>
          <SectionHeader title="Browse by Category" linkTo="/browse" linkLabel="All categories" />
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/browse?cat=${encodeURIComponent(cat.name)}`}
                className="group flex flex-col items-center gap-2 p-3 bg-white dark:bg-[#112038] rounded-xl border border-stone-100 dark:border-[#1C3058] shadow-sm hover:shadow-md hover:border-[#44B444] dark:hover:border-[#00B4C6] transition-all"
              >
                <span className="text-2xl">{cat.icon}</span>
                <span className="text-xs text-stone-600 font-medium text-center leading-tight group-hover:text-[#1C3270] transition-colors">
                  {cat.name}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Sponsored / Promoted */}
        {promoted.length > 0 && (
          <section>
            <SectionHeader
              title="Sponsored"
              subtitle="Paid promotions from campus shops — always clearly labelled"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
                : promoted.map((item) =>
                    "priceType" in item
                      ? <ServiceCard key={item.id} service={item as any} />
                      : <ProductCard key={item.id} product={item as any} />
                  )
              }
            </div>
          </section>
        )}

        {/* Top Rated Shops */}
        <section>
          <SectionHeader
            title="Top Rated Shops"
            subtitle="Highest rated by students this week"
            linkTo="/browse?sort=rating"
          />
          {loading ? (
            <HorizontalScroll>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-56"><SkeletonCard type="shop" /></div>
              ))}
            </HorizontalScroll>
          ) : (
            <HorizontalScroll>
  {topRatedShops.map((shop, i) => (
    <div
      key={shop.id}
      className="flex-shrink-0 w-56 md:w-64"
    >
      <ShopCard shop={{ ...shop, rank: i + 1 }} />
    </div>
  ))}
</HorizontalScroll>
          )}
        </section>

        {/* Favourite Shops */}
        <section>
          <SectionHeader
            title="Your Favourite Shops"
            subtitle={favouriteShopsList.length > 0 ? "Shops you've followed — quick access anytime" : undefined}
            linkTo="/browse"
            linkLabel="Browse shops"
          />
          {loading ? (
            <HorizontalScroll>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-56"><SkeletonCard type="shop" /></div>
              ))}
            </HorizontalScroll>
          ) : favouriteShopsList.length > 0 ? (
            <HorizontalScroll>
              {favouriteShopsList.map((shop) => (
                <div key={shop.id} className="flex-shrink-0">
                  <ShopCard shop={shop} />
                </div>
              ))}
            </HorizontalScroll>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 bg-white dark:bg-[#112038] rounded-2xl border border-dashed border-stone-200 dark:border-[#1C3058] text-center gap-3">
              <div className="text-4xl">🏪</div>
              <div>
                <p className="font-semibold text-stone-700 text-sm">No favourite shops yet</p>
                <p className="text-stone-400 text-xs mt-1">
                  Open any shop and tap <strong>Follow</strong> to save it here.
                </p>
              </div>
              <Link
                to="/browse"
                className="mt-1 px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "#1C3270" }}
              >
                Discover Shops
              </Link>
            </div>
          )}
        </section>

        {/* New Arrivals */}
        <section>
          <SectionHeader
            title="New Arrivals"
            subtitle="Recently added products and services"
            linkTo="/browse"
          />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : newArrivals.map((item) =>
                  "priceType" in item
                    ? <ServiceCard key={item.id} service={item as any} />
                    : <ProductCard key={item.id} product={item as any} />
                )
            }
          </div>
        </section>

        {/* Recently Viewed */}
        {recentlyViewed.length > 0 && (
          <section>
            <SectionHeader title="Recently Viewed" />
            <HorizontalScroll>
              {recentlyViewed.slice(0, 8).map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  to={`/${item.type}/${item.slug}`}
                  className="flex-shrink-0 w-40 group"
                >
                  <div className="aspect-[4/3] bg-stone-100 rounded-xl overflow-hidden mb-2">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  </div>
                  <div className="font-medium text-xs text-stone-800 line-clamp-2 group-hover:text-[#1C3270] transition-colors leading-snug">
                    {item.name}
                  </div>
                  {item.price !== undefined && (
                    <div className="text-xs font-bold mt-0.5" style={{ color: "#1C3270" }}>
                      RM {item.price.toFixed(2)}
                    </div>
                  )}
                  {item.shopName && (
                    <div className="text-[10px] text-stone-400 mt-0.5">{item.shopName}</div>
                  )}
                </Link>
              ))}
            </HorizontalScroll>
          </section>
        )}

        {/* How It Works */}
        <section className="bg-white dark:bg-[#112038] rounded-2xl border border-stone-100 dark:border-[#1C3058] shadow-sm p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>
              How AIU Market Works
            </h2>
            <p className="text-stone-500 mt-1 text-sm">Three simple steps — browse, order, pick up.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: "🔍",
                title: "Browse",
                desc: "Explore student shops by category or search for what you need. Filter by location, rating, and price.",
              },
              {
                step: "02",
                icon: "🛒",
                title: "Order or Book",
                desc: "Add products to cart or submit a booking request for services. Pay securely with Touch 'n Go, FPX, or card.",
              },
              {
                step: "03",
                icon: "📦",
                title: "Pickup & Done",
                desc: "Coordinate with the seller via WhatsApp and collect from their campus pickup location.",
              },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className="relative inline-flex mb-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm dark:!bg-[#0E1A2E] dark:!border-[#1C3058]"
                    style={{ background: "#EEF2FA", border: "2px solid #DDE3F0" }}
                  >
                    {s.icon}
                  </div>
                  <span
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-xs font-bold text-white flex items-center justify-center"
                    style={{ background: "#44B444" }}
                  >
                    {s.step}
                  </span>
                </div>
                <h3 className="font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>
                  {s.title}
                </h3>
                <p className="text-stone-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA — open a shop */}
        {!user?.hasShop && (
          <section
            className="rounded-2xl overflow-hidden relative"
            style={{ background: "linear-gradient(135deg, #44B444 0%, #2E8A2E 100%)" }}
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)",
                backgroundSize: "20px 20px",
              }}
            />
            <div className="relative px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2
                  className="text-2xl font-bold text-white mb-2"
                  style={{ fontFamily: "Lora, serif" }}
                >
                  Have a skill or side business? Open your shop today.
                </h2>
                <p className="text-white/80 text-sm max-w-md leading-relaxed">
                  Sell food, fashion, tutoring, printing, and more to fellow AIU students.
                  Free to start — just fill in a short form and wait for approval.
                </p>
              </div>
              <Link
                to="/become-seller"
                className="flex-shrink-0 px-8 py-3 bg-white font-bold rounded-xl hover:bg-stone-50 transition-colors shadow-md text-sm"
                style={{ color: "#1C3270" }}
              >
                Open My Shop →
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
