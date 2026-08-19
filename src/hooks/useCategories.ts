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
      .select("id,name,icon,sort_order")
      .order("sort_order", { ascending: true });
    if (data && data.length > 0) setCategories(data as Category[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return { categories, loading, reload: load };
}
