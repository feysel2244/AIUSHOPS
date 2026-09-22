/**
 * Shared hook: loads categories from Supabase (falling back to static CATEGORIES
 * if the network fails or the table doesn't exist yet).
 *
 * Usage: const { categories, loading } = useCategories();
 */

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export type Category = {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
};

// Fallback used during first render / offline
const STATIC_FALLBACK: Category[] = [
  { id: "food",        name: "Food & Drinks",  icon: "🍱", sort_order: 1 },
  { id: "fashion",     name: "Fashion",         icon: "👗", sort_order: 2 },
  { id: "tutoring",    name: "Tutoring",         icon: "📚", sort_order: 3 },
  { id: "printing",    name: "Printing",         icon: "🖨️", sort_order: 4 },
  { id: "electronics", name: "Electronics",      icon: "💻", sort_order: 5 },
  { id: "crafts",      name: "Crafts & Art",     icon: "🎨", sort_order: 6 },
  { id: "beauty",      name: "Beauty",           icon: "💄", sort_order: 7 },
  { id: "sports",      name: "Sports",           icon: "⚽", sort_order: 8 },
];

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(STATIC_FALLBACK);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("categories")
      .select("id,name,icon,sort_order");
      
    if (data && data.length > 0) {
      // Fetch lightweight counts to determine popularity
      const now = new Date().toISOString();
      const [prodRes, servRes, quickRes] = await Promise.all([
        supabase.from("products").select("category").eq("status", "approved").is("deleted_at", null),
        supabase.from("services").select("category").eq("status", "approved").is("deleted_at", null),
        supabase.from("quick_listings").select("category").eq("status", "active").gt("expires_at", now)
      ]);

      const counts: Record<string, number> = {};
      const tally = (list: any[] | null) => {
        if (!list) return;
        for (const row of list) {
          counts[row.category] = (counts[row.category] || 0) + 1;
        }
      };

      tally(prodRes.data);
      tally(servRes.data);
      tally(quickRes.data);

      const enriched = (data as Category[]).sort((a, b) => {
        const countA = counts[a.name] || 0;
        const countB = counts[b.name] || 0;
        if (countB !== countA) return countB - countA; // Descending by popularity
        return a.sort_order - b.sort_order; // Fallback to sort_order
      });

      setCategories(enriched);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return { categories, loading, reload: load };
}
