import { supabase } from "./supabase";

export type BuyerProfileInput = {
  id: string;
  name?: string;
  email?: string;
  department?: string;
  year?: string;
  whatsapp?: string;
};

export async function ensureBuyerProfile(user: BuyerProfileInput) {
  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return { ok: true as const };
  if (lookupError) {
    return {
      ok: false as const,
      message: lookupError.message || "Could not check your buyer profile.",
    };
  }

  const { error: insertError } = await supabase.from("profiles").insert({
    id: user.id,
    name: user.name || user.email || "AIU Student",
    email: user.email || "",
    department: user.department || "",
    year: user.year || "",
    whatsapp: user.whatsapp || "",
    has_shop: false,
    is_admin: false,
  });

  if (insertError) {
    return {
      ok: false as const,
      message: insertError.message || "Could not create your buyer profile.",
    };
  }

  return { ok: true as const };
}
