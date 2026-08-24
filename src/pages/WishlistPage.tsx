import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/cards/ProductCard";
import ServiceCard from "../components/cards/ServiceCard";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { toProduct, toService } from "../lib/marketData";

export default function WishlistPage() {
  const { user, openAuthModal } = useApp();
  const [products, setProducts] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    let active = true;
    async function loadWishlist() {
      setLoading(true);
      const { data } = await supabase
        .from("wishlist_items")
        .select("products(*,shops(*,profiles(name,department,year,whatsapp))),services(*,shops(*,profiles(name,department,year,whatsapp)))")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!active) return;
      setProducts((data ?? []).map((row: any) => row.products).filter(Boolean).map(toProduct));
      setServices((data ?? []).map((row: any) => row.services).filter(Boolean).map(toService));
      setLoading(false);
    }

    void loadWishlist();
    return () => { active = false; };
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Sign in to view your wishlist</h2>
        <p className="text-stone-500 mb-4">Saved products and services are linked to your account.</p>
        <button onClick={() => openAuthModal("login")} className="px-6 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium">Log in</button>
      </div>
    );
  }

  const empty = !loading && products.length === 0 && services.length === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Wishlist</h1>
          <p className="text-sm text-stone-500">Your saved marketplace listings.</p>
        </div>
        <Link to="/browse" className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-50">Browse</Link>
      </div>

      {loading ? (
        <div className="py-16 text-center text-stone-500">Loading wishlist...</div>
      ) : empty ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
          <h2 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>No saved listings yet</h2>
          <p className="text-sm text-stone-500 mb-4">Save products or services from browse pages to find them here later.</p>
          <Link to="/browse" className="px-6 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium">Browse Listings</Link>
        </div>
      ) : (
        <div className="space-y-8">
          {products.length > 0 && (
            <section>
              <h2 className="font-bold text-stone-700 text-sm uppercase tracking-wide mb-3">Products</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
            </section>
          )}
          {services.length > 0 && (
            <section>
              <h2 className="font-bold text-stone-700 text-sm uppercase tracking-wide mb-3">Services</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {services.map((service) => <ServiceCard key={service.id} service={service} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
