import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { notifySellerCommissionStatus, notifySellerPromoStatus } from "../lib/payments";
import { uploadImage, validateImageFile } from "../lib/uploadImage";
import {
  getCommissionOverview,
  startOfMonth,
  startOfNextMonth,
  type CommissionOverviewRow,
} from "../lib/commissions";

type Tab = "dashboard" | "approvals" | "users" | "categories" | "promotions" | "payouts" | "stats" | "settings";
type PromoRequest = {
  id: string;
  shop_id: string;
  listing_type: string;
  listing_id: string;
  duration_days: number;
  amount: number;
  receipt_url: string | null;
  status: string;
  submitted_at: string;
  shopName: string;
  shopOwnerId: string;
  listingName: string;
};
type RealUser = {
  id: string;
  name: string;
  email: string;
  department: string;
  year: string;
  created_at: string;
  has_shop: boolean;
  is_admin: boolean;
  is_suspended: boolean;
};
type RealCategory = { id: string; name: string; icon: string; sort_order: number; };
type PlatStats = { totalOrders: number; totalUsers: number; paidOrderCount: number; gmv: number; promoRevenue: number; };
type CommissionSettlementRequest = {
  id: string;
  shop_id: string;
  period_month: string;
  order_count: number;
  amount_owed: number;
  receipt_url: string | null;
  status: string;
  submitted_at: string | null;
  shopName: string;
  shopOwnerId: string;
};

export default function AdminPanel() {
  const { user } = useApp();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [pendingShops, setPendingShops] = useState<any[]>([]);
  const [users, setUsers] = useState<RealUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [cats, setCats] = useState<RealCategory[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [newCat, setNewCat] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("📁");
  const [activeShopCount, setActiveShopCount] = useState(0);
  const [pendingPromos, setPendingPromos] = useState<PromoRequest[]>([]);
  const [promoRejectModal, setPromoRejectModal] = useState<string | null>(null);
  const [promoRejectReason, setPromoRejectReason] = useState("");
  const [promoAction, setPromoAction] = useState(false);
  const [commissionOverview, setCommissionOverview] = useState<CommissionOverviewRow[]>([]);
  const [commissionPeriod, setCommissionPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [pendingSettlements, setPendingSettlements] = useState<CommissionSettlementRequest[]>([]);
  const [settlementRejectModal, setSettlementRejectModal] = useState<string | null>(null);
  const [settlementRejectReason, setSettlementRejectReason] = useState("");
  const [settlementAction, setSettlementAction] = useState(false);
  const [commissionSavingId, setCommissionSavingId] = useState<string | null>(null);
  // Platform stats
  const [platStats, setPlatStats] = useState<PlatStats | null>(null);
  // Platform settings (for payment QR)
  const [platSettings, setPlatSettings] = useState<any>(null);
  const [platQrPreview, setPlatQrPreview] = useState("");
  const [platQrUploading, setPlatQrUploading] = useState(false);
  const [platQrError, setPlatQrError] = useState("");
  const [platSaving, setPlatSaving] = useState(false);
  const [platSaveError, setPlatSaveError] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementSaving, setAnnouncementSaving] = useState(false);
  const [announcementSaveError, setAnnouncementSaveError] = useState("");
  const [platForm, setPlatForm] = useState({ bank_name: "", account_name: "", account_number: "" });
  const platQrRef = useRef<HTMLInputElement>(null);

  async function loadPromotions() {
    const { data } = await supabase
      .from("listing_promotions")
      .select("id,shop_id,listing_type,listing_id,duration_days,amount,receipt_url,status,submitted_at,shops(name,owner_id,products(id,name),services(id,name))")
      .eq("status", "pending")
      .order("submitted_at", { ascending: true });
    if (data) {
      setPendingPromos(
        (data as any[]).map((row) => {
          const shop = row.shops as any;
          const product = (shop?.products ?? []).find((p: any) => p.id === row.listing_id);
          const service = (shop?.services ?? []).find((s: any) => s.id === row.listing_id);
          return {
            id: row.id,
            shop_id: row.shop_id,
            listing_type: row.listing_type,
            listing_id: row.listing_id,
            duration_days: row.duration_days,
            amount: Number(row.amount),
            receipt_url: row.receipt_url ?? null,
            status: row.status,
            submitted_at: row.submitted_at,
            shopName: shop?.name ?? "Shop",
            shopOwnerId: shop?.owner_id ?? "",
            listingName: product?.name ?? service?.name ?? "Listing",
          };
        })
      );
    }
  }

  async function loadPayouts() {
    const [year, month] = commissionPeriod.split("-").map(Number);
    const periodStart = new Date(year, month - 1, 1);
    const [overviewRows, { data: settlementRows }] = await Promise.all([
      getCommissionOverview(periodStart, startOfNextMonth(periodStart)),
      supabase
        .from("commission_settlements")
        .select("id,shop_id,period_month,order_count,amount_owed,receipt_url,status,submitted_at,shops(name,owner_id)")
        .eq("status", "pending")
        .order("submitted_at", { ascending: true }),
    ]);
    setCommissionOverview(overviewRows);
    setPendingSettlements((settlementRows ?? []).map((row: any) => ({
      id: row.id,
      shop_id: row.shop_id,
      period_month: row.period_month,
      order_count: Number(row.order_count || 0),
      amount_owed: Number(row.amount_owed || 0),
      receipt_url: row.receipt_url ?? null,
      status: row.status,
      submitted_at: row.submitted_at ?? null,
      shopName: row.shops?.name ?? "Shop",
      shopOwnerId: row.shops?.owner_id ?? "",
    })));
  }

  async function saveCommissionRate(shopId: string, value: number) {
    setCommissionSavingId(shopId);
    const { error } = await supabase
      .from("shops")
      .update({ commission_per_order: value })
      .eq("id", shopId);
    if (!error) {
      setCommissionOverview((prev) =>
        prev.map((row) =>
          row.shopId === shopId
            ? { ...row, commissionPerOrder: value, amountOwed: Number((row.period.orderCount * value).toFixed(2)) }
            : row
        ).sort((a, b) => b.amountOwed - a.amountOwed)
      );
    }
    setCommissionSavingId(null);
  }

  async function loadCategories() {
    setCatsLoading(true);
    const { data } = await supabase.from("categories").select("id,name,icon,sort_order").order("sort_order", { ascending: true });
    if (data) setCats(data as RealCategory[]);
    setCatsLoading(false);
  }

  async function loadUsers() {
    setUsersLoading(true);
    const { data } = await supabase.from("profiles").select("id,name,email,department,year,created_at,has_shop,is_admin,is_suspended").order("created_at", { ascending: false });
    if (data) setUsers(data as RealUser[]);
    setUsersLoading(false);
  }

  async function loadPlatStats() {
    const [{ count: totalOrders }, { count: totalUsers }, { count: paidOrderCount }, { data: paidOrders }, { data: promos }] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("payment_status", "paid"),
      supabase.from("orders").select("total").eq("payment_status", "paid"),
      supabase.from("listing_promotions").select("amount").eq("status", "approved"),
    ]);
    const gmv = (paidOrders ?? []).reduce((s, r) => s + Number(r.total), 0);
    const promoRevenue = (promos ?? []).reduce((s, r) => s + Number(r.amount), 0);
    setPlatStats({
      totalOrders: totalOrders ?? 0,
      totalUsers: totalUsers ?? 0,
      paidOrderCount: paidOrderCount ?? 0,
      gmv,
      promoRevenue,
    });
  }

  async function loadPlatSettings() {
    const { data } = await supabase.from("platform_settings").select("*").eq("id", true).maybeSingle();
    if (data) {
      setPlatSettings(data);
      setPlatForm({ bank_name: data.bank_name ?? "", account_name: data.account_name ?? "", account_number: data.account_number ?? "" });
      setAnnouncementText(data.announcement_text ?? "");
    }
  }

  async function saveAnnouncement() {
    setAnnouncementSaving(true);
    setAnnouncementSaveError("");
    const text = announcementText.trim();
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ id: true, announcement_text: text || null }, { onConflict: "id" });
    if (error) setAnnouncementSaveError(error.message);
    setAnnouncementSaving(false);
  }

  async function loadPendingShops() {
    const [{ data, error: shopsError }, { count }] = await Promise.all([
      supabase
        .from("shops")
        .select("id,owner_id,name,category,shop_type,bio,created_at,profiles(name,email,department)")
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      supabase.from("shops").select("id", { count: "exact", head: true }).eq("status", "approved").is("deleted_at", null),
    ]);
    if (shopsError) { console.error("Could not load seller applications:", shopsError.message); return; }
    setPendingShops((data ?? []).map((shop: any) => ({
      id: shop.id, ownerId: shop.owner_id, name: shop.name, owner: shop.profiles?.name || "Applicant",
      dept: shop.profiles?.department || "", email: shop.profiles?.email || "", category: shop.category,
      shopType: shop.shop_type || "both", submittedAt: shop.created_at ? new Date(shop.created_at).toLocaleDateString("en-MY") : "", bio: shop.bio || "",
    })));
    setActiveShopCount(count ?? 0);
  }

  useEffect(() => {
    if (!user?.isAdmin) return;
    void loadPendingShops();
    void loadPromotions();
    void loadUsers();
    void loadCategories();
    void loadPlatStats();
    void loadPlatSettings();
    void loadPayouts();

    const channel = supabase.channel("admin-shop-applications")
      .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, () => { void loadPendingShops(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.isAdmin, commissionPeriod]);

  // Site-wide feature flags
  const [flags, setFlags] = useState({
    shopRegistration: true,
    guestBrowsing: true,
    promotedListings: true,
    maintenanceMode: false,
    announcementBanner: true,
    reviewsEnabled: true,
    wishlistEnabled: true,
    whatsappEnabled: true,
  });

  function toggleFlag(key: keyof typeof flags) {
    setFlags((f) => ({ ...f, [key]: !f[key] }));
  }

  if (!user?.isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Admin access only</h2>
        <p className="text-stone-500 text-sm">Sign in with an admin account to access this panel.</p>
        <div className="mt-4 p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-500 text-left">
          Sign in with the administrator account configured in Supabase Auth.
        </div>
        <Link to="/" onClick={() => {}} className="inline-block mt-4 text-sm text-[#1C3270] hover:underline">← Back to marketplace</Link>
      </div>
    );
  }

  async function approveShop(id: string) {
    const shop = pendingShops.find((s: any) => s.id === id) as any;
    const { error: shopError } = await supabase.from("shops").update({ status: "approved", is_open: true }).eq("id", id);
    if (shopError) return;
    if (shop?.ownerId) {
      await supabase.from("profiles").update({ has_shop: true }).eq("id", shop.ownerId);
      await supabase.from("notifications").insert({ user_id: shop.ownerId, icon: "🎉", title: "Shop approved", body: `Your shop “${shop.name}” has been approved. You can now open your seller dashboard.`, type: "shop", link_to: "/seller/dashboard", is_unread: true });
    }
    setPendingShops((prev) => prev.filter((s) => s.id !== id));
  }

  async function rejectShop(id: string) {
    const shop = pendingShops.find((s: any) => s.id === id) as any;
    await supabase.from("shops").update({ status: "rejected", rejection_reason: rejectReason }).eq("id", id);
    if (shop?.ownerId) await supabase.from("notifications").insert({ user_id: shop.ownerId, icon: "⚠️", title: "Shop application not approved", body: `Your shop “${shop.name}” was not approved. ${rejectReason ? `Reason: ${rejectReason}` : "Please review your application details."}`, type: "shop", link_to: "/become-seller", is_unread: true });
    setPendingShops((prev) => prev.filter((s) => s.id !== id));
    setRejectModal(null);
    setRejectReason("");
  }

  async function toggleUserSuspended(id: string, currentSuspended: boolean) {
    const next = !currentSuspended;
    await supabase.from("profiles").update({ is_suspended: next }).eq("id", id);
    setUsers((prev) => prev.map((u) => u.id === id ? { ...u, is_suspended: next } : u));
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    const maxOrder = cats.reduce((m, c) => Math.max(m, c.sort_order), 0);
    const { data } = await supabase.from("categories").insert({ name: newCat.trim(), icon: newCatIcon, sort_order: maxOrder + 1 }).select("id,name,icon,sort_order").single();
    if (data) setCats((prev) => [...prev, data as RealCategory]);
    setNewCat(""); setNewCatIcon("📁");
  }

  async function removeCategory(id: string) {
    await supabase.from("categories").delete().eq("id", id);
    setCats((prev) => prev.filter((c) => c.id !== id));
  }

  async function savePlatSettings() {
    setPlatSaving(true); setPlatSaveError("");
    const { error } = await supabase.from("platform_settings").upsert({ id: true, ...platForm }, { onConflict: "id" });
    if (error) setPlatSaveError(error.message);
    else await loadPlatSettings();
    setPlatSaving(false);
  }

  async function handlePlatQrChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setPlatQrError(err); return; }
    setPlatQrError(""); setPlatQrPreview(URL.createObjectURL(file)); setPlatQrUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const url = await uploadImage("platform-qr", `platform/qr-${Date.now()}.${ext}`, file);
      await supabase.from("platform_settings").upsert({ id: true, payment_qr_url: url }, { onConflict: "id" });
      await loadPlatSettings();
    } catch (uploadErr) { setPlatQrError(uploadErr instanceof Error ? uploadErr.message : "Upload failed"); }
    finally { setPlatQrUploading(false); e.target.value = ""; }
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "approvals", label: pendingShops.length > 0 ? `Approvals (${pendingShops.length})` : "Approvals", icon: "⏳" },
    { id: "users", label: "Users", icon: "👥" },
    { id: "categories", label: "Categories", icon: "🏷️" },
    { id: "promotions", label: pendingPromos.length > 0 ? `Promotions (${pendingPromos.length})` : "Promotions", icon: "✦" },
    { id: "payouts", label: pendingSettlements.length > 0 ? `Payouts (${pendingSettlements.length})` : "Payouts", icon: "💰" },
    { id: "stats", label: "Stats", icon: "📈" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1C3270] text-white rounded-xl flex items-center justify-center text-lg flex-shrink-0">⚙️</div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Admin Panel</h1>
            <p className="text-stone-400 text-xs">AIU Market — Platform Administration · Logged in as {user.name}</p>
          </div>
        </div>
        <button onClick={() => void loadPendingShops()} className="px-3 py-2 border border-stone-200 bg-white rounded-lg text-xs font-semibold text-stone-600 hover:bg-stone-50">Refresh applications</button>
        {flags.maintenanceMode && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
            🚧 Maintenance mode ON
          </div>
        )}
      </div>

      {/* Mobile tab bar */}
      <div className="lg:hidden hide-scrollbar flex gap-1 overflow-x-auto bg-white border border-stone-100 rounded-xl p-1 mb-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? "bg-[#1C3270] text-white" : "text-stone-500 hover:text-stone-700"}`}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sidebar — desktop only */}
        <nav className="hidden lg:block lg:col-span-1">
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-stone-50 last:border-0 ${tab === t.id ? "bg-[#1C3270]/5 text-[#1C3270] border-l-2 border-l-[#1C3270]" : "text-stone-600 hover:bg-stone-50"}`}
              >
                <span>{t.icon}</span> <span className="flex-1">{t.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="lg:col-span-4">
          {/* Dashboard */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: platStats ? platStats.totalUsers.toLocaleString() : "…", icon: "👥", trend: "Registered accounts" },
                  { label: "Active Shops", value: `${activeShopCount}`, icon: "🏪", trend: `${pendingShops.length} pending approval` },
                  { label: "Total GMV", value: platStats ? `RM ${platStats.gmv.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "…", icon: "💰", trend: "Paid orders only" },
                  { label: "Pending Reviews", value: `${pendingShops.length}`, icon: "⏳", trend: "Awaiting approval" },
                ].map((c) => (
                  <div key={c.label} className="bg-white rounded-xl border border-stone-100 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{c.icon}</span>
                      <span className="text-xs text-stone-400 font-medium">{c.label}</span>
                    </div>
                    <div className="font-bold text-xl text-stone-900" style={{ fontFamily: "Lora, serif" }}>{c.value}</div>
                    <div className="text-xs text-stone-400 mt-0.5">{c.trend}</div>
                  </div>
                ))}
              </div>

              {pendingShops.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 text-sm" style={{ fontFamily: "Lora, serif" }}>⏳ {pendingShops.length} shop{pendingShops.length > 1 ? "s" : ""} awaiting approval</h3>
                  {pendingShops.map((s) => (
                    <div key={s.id} className="flex items-center justify-between bg-white rounded-lg p-3 mb-2">
                      <div>
                        <span className="font-medium text-sm">{s.name}</span>
                        <span className="text-xs text-stone-400 ml-2">by {s.owner}</span>
                      </div>
                      <button onClick={() => setTab("approvals")} className="text-xs text-[#1C3270] font-medium">Review →</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Approvals */}
          {tab === "approvals" && (
            <div className="space-y-4">
              <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Shop Approval Queue</h3>
              {pendingShops.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-stone-500 text-sm">All caught up — no pending shop applications.</p>
                </div>
              ) : (
                pendingShops.map((shop) => (
                  <div key={shop.id} className="bg-white rounded-2xl border border-stone-100 p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>{shop.name}</h4>
                        <div className="text-sm text-stone-500">{shop.owner} · {shop.dept} · <a href={`mailto:${shop.email}`} className="text-[#1C3270] hover:underline">{shop.email}</a></div>
                      </div>
                      <span className="text-xs text-stone-400">{shop.submittedAt}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                      <div className="p-2 bg-stone-50 rounded-lg"><span className="text-stone-400">Category: </span><span className="font-medium">{shop.category}</span></div>
                    </div>
                    <p className="text-sm text-stone-600 mb-4 bg-stone-50 rounded-lg p-3">{shop.bio}</p>
                    <div className="flex gap-3">
                      <button onClick={() => approveShop(shop.id)} className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors">✓ Approve</button>
                      <button onClick={() => setRejectModal(shop.id)} className="px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors">✕ Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Users */}
          {tab === "users" && (
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>User Management</h3>
                <button onClick={() => void loadUsers()} className="text-xs text-[#1C3270] border border-[#1C3270]/30 px-3 py-1 rounded-lg hover:bg-[#1C3270]/5">↻ Refresh</button>
              </div>
              {usersLoading ? (
                <div className="p-8 text-center text-sm text-stone-400">Loading users…</div>
              ) : (
                <div className="divide-y divide-stone-50">
                  {users.map((u) => (
                    <div key={u.id} className="flex items-start gap-3 px-4 py-4">
                      <div className="w-9 h-9 rounded-full bg-[#1C3270] text-white flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
                        {(u.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-stone-900">{u.name || "(no name)"}</div>
                        <div className="text-xs text-stone-400 truncate">{u.email}</div>
                        <div className="text-xs text-stone-400">{u.department || "—"} · {u.year || "—"}</div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          {u.has_shop && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Seller</span>}
                          {u.is_admin && <span className="text-xs bg-[#1C3270]/10 text-[#1C3270] border border-[#1C3270]/20 px-2 py-0.5 rounded-full">Admin</span>}
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${u.is_suspended ? "bg-red-50 text-red-600 border-red-200" : "bg-green-50 text-green-700 border-green-200"}`}>
                            {u.is_suspended ? "Suspended" : "Active"}
                          </span>
                          {!u.is_admin && (
                            <button
                              onClick={() => void toggleUserSuspended(u.id, u.is_suspended)}
                              className={`text-xs px-3 py-1 rounded-lg border transition-colors ${u.is_suspended ? "border-green-200 text-green-600 hover:bg-green-50" : "border-red-200 text-red-500 hover:bg-red-50"}`}
                            >
                              {u.is_suspended ? "Reinstate" : "Suspend"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-stone-400 flex-shrink-0">{u.created_at ? new Date(u.created_at).toLocaleDateString("en-MY") : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Categories */}
          {tab === "categories" && (
            <div className="bg-white rounded-2xl border border-stone-100 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Category Management</h3>
                <button onClick={() => void loadCategories()} className="text-xs text-[#1C3270] border border-[#1C3270]/30 px-3 py-1 rounded-lg hover:bg-[#1C3270]/5">↻ Refresh</button>
              </div>
              <div className="flex gap-2 mb-5">
                <input value={newCatIcon} onChange={(e) => setNewCatIcon(e.target.value)} className="w-12 px-2 py-2 border border-stone-200 rounded-lg text-sm text-center bg-stone-50 focus:outline-none" placeholder="Icon" />
                <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category name..." className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" />
                <button
                  onClick={() => void addCategory()}
                  className="px-4 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium hover:bg-[#0F1F4A]"
                >
                  Add
                </button>
              </div>
              {catsLoading ? (
                <div className="text-sm text-stone-400 text-center py-4">Loading…</div>
              ) : (
                <div className="space-y-2">
                  {cats.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-lg border border-stone-100">
                      <span className="text-xl">{c.icon}</span>
                      <span className="flex-1 text-sm font-medium text-stone-900">{c.name}</span>
                      <span className="text-xs text-stone-400">order {c.sort_order}</span>
                      <button onClick={() => void removeCategory(c.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-stone-400 mt-4">Changes are live instantly across all category dropdowns and browse filters.</p>
            </div>
          )}

          {/* Promotions */}
          {tab === "promotions" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>
                  Promotion Requests
                </h3>
                <button
                  onClick={() => void loadPromotions()}
                  className="text-xs text-[#1C3270] border border-[#1C3270]/30 px-3 py-1 rounded-lg hover:bg-[#1C3270]/5 transition-colors"
                >
                  ↻ Refresh
                </button>
              </div>

              {pendingPromos.length === 0 ? (
                <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
                  <div className="text-4xl mb-3">✅</div>
                  <p className="text-stone-500 text-sm">No pending promotion requests.</p>
                </div>
              ) : (
                pendingPromos.map((promo) => (
                  <div key={promo.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                    <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="font-semibold text-stone-900 text-sm">{promo.listingName}</span>
                        <span className="mx-2 text-stone-300">·</span>
                        <span className="text-xs text-stone-500">{promo.shopName}</span>
                      </div>
                      <span className="text-xs text-stone-400">
                        {new Date(promo.submitted_at).toLocaleDateString("en-MY")}
                      </span>
                    </div>

                    <div className="px-5 py-4">
                      <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
                        <div className="p-2 bg-stone-50 rounded-lg">
                          <div className="text-xs text-stone-400">Type</div>
                          <div className="font-medium capitalize">{promo.listing_type}</div>
                        </div>
                        <div className="p-2 bg-stone-50 rounded-lg">
                          <div className="text-xs text-stone-400">Duration</div>
                          <div className="font-medium">{promo.duration_days} days</div>
                        </div>
                        <div className="p-2 bg-blue-50 rounded-lg">
                          <div className="text-xs text-stone-400">Fee Paid</div>
                          <div className="font-bold text-[#1C3270]">RM {promo.amount.toFixed(2)}</div>
                        </div>
                      </div>

                      {promo.receipt_url ? (
                        <div className="mb-4">
                          <div className="text-xs font-medium text-stone-500 mb-2">Payment Receipt</div>
                          <a href={promo.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                            <img
                              src={promo.receipt_url}
                              alt="Payment receipt"
                              className="max-h-48 rounded-xl border border-stone-200 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
                            />
                          </a>
                        </div>
                      ) : (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                          ⚠️ No receipt uploaded — seller did not attach a proof of payment.
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button
                          disabled={promoAction}
                          onClick={async () => {
                            setPromoAction(true);
                            const promotedUntil = new Date();
                            promotedUntil.setDate(promotedUntil.getDate() + promo.duration_days);
                            await supabase.from("listing_promotions").update({
                              status: "approved",
                              reviewed_at: new Date().toISOString(),
                              promoted_until: promotedUntil.toISOString(),
                            }).eq("id", promo.id);
                            // Mark the listing as promoted
                            if (promo.listing_type === "product") {
                              await supabase.from("products").update({
                                is_promoted: true,
                                promoted_until: promotedUntil.toISOString(),
                              }).eq("id", promo.listing_id);
                            } else {
                              await supabase.from("services").update({
                                is_promoted: true,
                                promoted_until: promotedUntil.toISOString(),
                              }).eq("id", promo.listing_id);
                            }
                            await notifySellerPromoStatus(promo.shopOwnerId, promo.listingName, true);
                            setPendingPromos((prev) => prev.filter((p) => p.id !== promo.id));
                            setPromoAction(false);
                          }}
                          className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          ✓ Approve & Activate
                        </button>
                        <button
                          disabled={promoAction}
                          onClick={() => setPromoRejectModal(promo.id)}
                          className="px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Promotion reject modal */}
          {promoRejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPromoRejectModal(null)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Reject Promotion</h3>
                <p className="text-sm text-stone-500 mb-3">Tell the seller why their promotion was not approved.</p>
                <textarea
                  value={promoRejectReason}
                  onChange={(e) => setPromoRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Receipt is unclear or payment amount doesn't match."
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setPromoRejectModal(null)} className="flex-1 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
                  <button
                    disabled={promoAction}
                    onClick={async () => {
                      if (!promoRejectModal) return;
                      const promo = pendingPromos.find((p) => p.id === promoRejectModal);
                      if (!promo) return;
                      setPromoAction(true);
                      await supabase.from("listing_promotions").update({
                        status: "rejected",
                        rejection_reason: promoRejectReason,
                        reviewed_at: new Date().toISOString(),
                      }).eq("id", promoRejectModal);
                      await notifySellerPromoStatus(promo.shopOwnerId, promo.listingName, false, promoRejectReason);
                      setPendingPromos((prev) => prev.filter((p) => p.id !== promoRejectModal));
                      setPromoRejectModal(null);
                      setPromoRejectReason("");
                      setPromoAction(false);
                    }}
                    className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                  >
                    Send Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === "payouts" && (
            <div className="space-y-6">
              {/* Payouts Overview — live per-shop sales & commission owed */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>
                    Payouts Overview
                  </h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="month"
                      value={commissionPeriod}
                      onChange={(e) => setCommissionPeriod(e.target.value)}
                      className="text-xs px-3 py-1.5 border border-stone-200 rounded-lg focus:outline-none focus:border-[#1C3270]"
                    />
                    <button
                      onClick={() => void loadPayouts()}
                      className="text-xs text-[#1C3270] border border-[#1C3270]/30 px-3 py-1.5 rounded-lg hover:bg-[#1C3270]/5 transition-colors"
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-stone-50 text-left text-xs text-stone-400 uppercase tracking-wide">
                          <th className="px-4 py-3 font-medium">Shop</th>
                          <th className="px-4 py-3 font-medium text-right">Today (orders)</th>
                          <th className="px-4 py-3 font-medium text-right">Today (RM)</th>
                          <th className="px-4 py-3 font-medium text-right">Month (orders)</th>
                          <th className="px-4 py-3 font-medium text-right">Month (RM)</th>
                          <th className="px-4 py-3 font-medium text-right">Per Order (RM)</th>
                          <th className="px-4 py-3 font-medium text-right">Owed This Month</th>
                        </tr>
                      </thead>
                      <tbody>
                        {commissionOverview.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-stone-400 text-sm">
                              No approved shops with sales for this period yet.
                            </td>
                          </tr>
                        ) : (
                          commissionOverview.map((row) => (
                            <tr key={row.shopId} className="border-t border-stone-50">
                              <td className="px-4 py-3 font-medium text-stone-800">{row.shopName}</td>
                              <td className="px-4 py-3 text-right text-stone-600">{row.today.orderCount}</td>
                              <td className="px-4 py-3 text-right text-stone-600">RM {row.today.totalSales.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-stone-600">{row.period.orderCount}</td>
                              <td className="px-4 py-3 text-right text-stone-600">RM {row.period.totalSales.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  defaultValue={row.commissionPerOrder}
                                  disabled={commissionSavingId === row.shopId}
                                  onBlur={(e) => {
                                    const value = Number(e.target.value);
                                    if (!Number.isNaN(value) && value !== row.commissionPerOrder) {
                                      void saveCommissionRate(row.shopId, value);
                                    }
                                  }}
                                  className="w-24 text-right px-2 py-1 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] disabled:opacity-50"
                                />
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-[#1C3270]">RM {row.amountOwed.toFixed(2)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {commissionOverview.length > 0 && (
                        <tfoot>
                          <tr className="border-t-2 border-stone-100 bg-stone-50 font-bold">
                            <td className="px-4 py-3 text-stone-800" colSpan={6}>Grand total (platform revenue expected this month)</td>
                            <td className="px-4 py-3 text-right text-[#1C3270]">
                              RM {commissionOverview.reduce((sum, row) => sum + row.amountOwed, 0).toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
                <p className="text-xs text-stone-400">
                  Editing a shop's rate here only affects future calculations — see the note on historical accuracy if a rate changes mid-month.
                </p>
              </div>

              {/* Settlement receipt review queue */}
              <div className="space-y-4">
                <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>
                  Pending Settlement Receipts
                </h3>

                {pendingSettlements.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
                    <div className="text-4xl mb-3">✅</div>
                    <p className="text-stone-500 text-sm">No pending commission receipts to review.</p>
                  </div>
                ) : (
                  pendingSettlements.map((settlement) => (
                    <div key={settlement.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                      <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <span className="font-semibold text-stone-900 text-sm">{settlement.shopName}</span>
                          <span className="mx-2 text-stone-300">·</span>
                          <span className="text-xs text-stone-500">
                            {new Date(settlement.period_month).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
                          </span>
                        </div>
                        <span className="text-xs text-stone-400">
                          {settlement.submitted_at ? new Date(settlement.submitted_at).toLocaleDateString("en-MY") : ""}
                        </span>
                      </div>

                      <div className="px-5 py-4">
                        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                          <div className="p-2 bg-stone-50 rounded-lg">
                            <div className="text-xs text-stone-400">Order Count</div>
                            <div className="font-medium">{settlement.order_count}</div>
                          </div>
                          <div className="p-2 bg-blue-50 rounded-lg">
                            <div className="text-xs text-stone-400">Amount Owed</div>
                            <div className="font-bold text-[#1C3270]">RM {settlement.amount_owed.toFixed(2)}</div>
                          </div>
                        </div>

                        {settlement.receipt_url ? (
                          <div className="mb-4">
                            <div className="text-xs font-medium text-stone-500 mb-2">Payment Receipt</div>
                            <a href={settlement.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                              <img
                                src={settlement.receipt_url}
                                alt="Payment receipt"
                                className="max-h-48 rounded-xl border border-stone-200 object-contain hover:opacity-90 transition-opacity cursor-zoom-in"
                              />
                            </a>
                          </div>
                        ) : (
                          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                            ⚠️ No receipt uploaded — seller did not attach a proof of payment.
                          </div>
                        )}

                        <div className="flex gap-3">
                          <button
                            disabled={settlementAction}
                            onClick={async () => {
                              setSettlementAction(true);
                              await supabase.from("commission_settlements").update({
                                status: "approved",
                                reviewed_at: new Date().toISOString(),
                                reviewed_by: user.id,
                              }).eq("id", settlement.id);
                              await notifySellerCommissionStatus(
                                settlement.shopOwnerId,
                                new Date(settlement.period_month).toLocaleDateString("en-MY", { month: "long", year: "numeric" }),
                                true
                              );
                              setPendingSettlements((prev) => prev.filter((s) => s.id !== settlement.id));
                              setSettlementAction(false);
                            }}
                            className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                          >
                            ✓ Approve
                          </button>
                          <button
                            disabled={settlementAction}
                            onClick={() => setSettlementRejectModal(settlement.id)}
                            className="px-5 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            ✕ Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Settlement reject modal */}
          {settlementRejectModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSettlementRejectModal(null)} />
              <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Reject Commission Payment</h3>
                <p className="text-sm text-stone-500 mb-3">Tell the seller why this receipt was not approved.</p>
                <textarea
                  value={settlementRejectReason}
                  onChange={(e) => setSettlementRejectReason(e.target.value)}
                  rows={3}
                  placeholder="e.g., Receipt is unclear or amount doesn't match what's owed."
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none mb-4"
                />
                <div className="flex gap-3">
                  <button onClick={() => setSettlementRejectModal(null)} className="flex-1 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
                  <button
                    disabled={settlementAction}
                    onClick={async () => {
                      if (!settlementRejectModal) return;
                      const settlement = pendingSettlements.find((s) => s.id === settlementRejectModal);
                      if (!settlement) return;
                      setSettlementAction(true);
                      await supabase.from("commission_settlements").update({
                        status: "rejected",
                        rejection_reason: settlementRejectReason,
                        reviewed_at: new Date().toISOString(),
                        reviewed_by: user.id,
                      }).eq("id", settlementRejectModal);
                      await notifySellerCommissionStatus(
                        settlement.shopOwnerId,
                        new Date(settlement.period_month).toLocaleDateString("en-MY", { month: "long", year: "numeric" }),
                        false,
                        settlementRejectReason
                      );
                      setPendingSettlements((prev) => prev.filter((s) => s.id !== settlementRejectModal));
                      setSettlementRejectModal(null);
                      setSettlementRejectReason("");
                      setSettlementAction(false);
                    }}
                    className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 disabled:opacity-50"
                  >
                    Send Rejection
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Site Settings */}
          {tab === "settings" && (
            <div className="space-y-5">
              <div className="bg-white rounded-2xl border border-stone-100 p-5">
                <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>Site Feature Flags</h3>
                <p className="text-xs text-stone-400 mb-5">Toggle platform features on or off. Changes take effect immediately.</p>
                <div className="space-y-3">
                  {(
                    [
                      { key: "shopRegistration", label: "New Shop Registrations", desc: "Allow students to submit new shop applications" },
                      { key: "guestBrowsing", label: "Guest Browsing", desc: "Allow unauthenticated users to browse listings" },
                      { key: "promotedListings", label: "Promoted Listings", desc: "Enable paid promotion feature for sellers" },
                      { key: "announcementBanner", label: "Announcement Banner", desc: "Show the top announcement bar to all users" },
                      { key: "reviewsEnabled", label: "Reviews & Ratings", desc: "Allow buyers to leave reviews on orders" },
                      { key: "wishlistEnabled", label: "Wishlist", desc: "Allow users to save items to their wishlist" },
                      { key: "whatsappEnabled", label: "WhatsApp Messaging", desc: "Show 'Message Seller' button on listings" },
                      { key: "maintenanceMode", label: "Maintenance Mode", desc: "Show a maintenance page to non-admin visitors", danger: true },
                    ] as { key: keyof typeof flags; label: string; desc: string; danger?: boolean }[]
                  ).map(({ key, label, desc, danger }) => (
                    <div key={key} className={`flex items-center justify-between gap-4 p-4 rounded-xl border ${danger && flags[key] ? "bg-red-50 border-red-200" : "bg-stone-50 border-stone-100"}`}>
                      <div className="min-w-0">
                        <div className={`font-medium text-sm ${danger ? "text-red-700" : "text-stone-900"}`}>{label}</div>
                        <div className="text-xs text-stone-400 mt-0.5">{desc}</div>
                      </div>
                      <button
                        onClick={() => toggleFlag(key)}
                        className={`flex-shrink-0 w-12 h-6 rounded-full relative transition-colors ${flags[key] ? (danger ? "bg-red-500" : "bg-[#44B444]") : "bg-stone-300"}`}
                        aria-label={`Toggle ${label}`}
                      >
                        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${flags[key] ? "translate-x-6" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-100 p-5">
                <h3 className="font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>Platform Fee</h3>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm text-stone-600">Current platform fee charged on every order</p>
                    <p className="text-xs text-stone-400 mt-0.5">Applies to all transactions marketplace-wide</p>
                  </div>
                  <div className="flex items-center gap-1 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                    <input
                      type="number"
                      defaultValue={2}
                      min={0}
                      max={20}
                      step={0.5}
                      className="w-12 text-center font-bold text-stone-900 bg-transparent outline-none text-sm"
                    />
                    <span className="text-stone-500 text-sm">%</span>
                  </div>
                </div>
              </div>

              {/* Platform Payment Settings */}
              <div className="bg-white rounded-2xl border border-stone-100 p-5">
                <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>Platform Payment Settings</h3>
                <p className="text-xs text-stone-400 mb-4">Sellers submit promotion fees to this account. Upload your platform&apos;s own QR code (TnG / DuitNow) and bank details.</p>
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative w-24 h-24 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0 border border-stone-200 overflow-hidden">
                    {(platQrPreview || platSettings?.payment_qr_url)
                      ? <img src={platQrPreview || platSettings?.payment_qr_url} alt="Platform QR" className="w-full h-full object-contain" />
                      : <span className="text-2xl">📱</span>
                    }
                    {platQrUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50 text-sm text-stone-600">
                      📁 Upload platform QR
                      <input ref={platQrRef} type="file" accept="image/*" className="hidden" disabled={platQrUploading} onChange={handlePlatQrChange} />
                    </label>
                    <p className="text-xs text-stone-400 mt-1.5">Sellers scan this to pay promotion fees</p>
                    {platQrError && <p className="text-xs text-red-500 mt-1">{platQrError}</p>}
                  </div>
                </div>
                <div className="space-y-3">
                  <input value={platForm.bank_name} onChange={(e) => setPlatForm((f) => ({ ...f, bank_name: e.target.value }))} placeholder="Bank / E-wallet name" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" />
                  <input value={platForm.account_name} onChange={(e) => setPlatForm((f) => ({ ...f, account_name: e.target.value }))} placeholder="Account holder name" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" />
                  <input value={platForm.account_number} onChange={(e) => setPlatForm((f) => ({ ...f, account_number: e.target.value }))} placeholder="Account / e-wallet number" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" />
                </div>
                {platSaveError && <p className="text-xs text-red-500 mt-2">{platSaveError}</p>}
                <button onClick={() => void savePlatSettings()} disabled={platSaving} className="mt-4 px-5 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium hover:bg-[#0F1F4A] transition-colors disabled:opacity-60">
                  {platSaving ? "Saving…" : "Save Payment Details"}
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-stone-100 p-5">
                <h3 className="font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>Announcement Banner Text</h3>
                <p className="text-xs text-stone-400 mb-3">Leave this empty to hide the banner. Add any message here when you want it shown at the top of the marketplace.</p>
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="e.g. Exam week notice: Some shops may have reduced hours..."
                  rows={3}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none mb-3"
                />
                {announcementSaveError && <p className="text-xs text-red-500 mb-3">{announcementSaveError}</p>}
                <button onClick={() => void saveAnnouncement()} disabled={announcementSaving} className="px-5 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium hover:bg-[#0F1F4A] transition-colors disabled:opacity-60">
                  {announcementSaving ? "Saving..." : announcementText.trim() ? "Save Banner Text" : "Remove Banner"}
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          {tab === "stats" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Platform Statistics</h3>
                  <button onClick={() => void loadPlatStats()} className="text-xs text-[#1C3270] border border-[#1C3270]/30 px-3 py-1 rounded-lg hover:bg-[#1C3270]/5">↻ Refresh</button>
                </div>
                {!platStats ? (
                  <div className="text-sm text-stone-400 text-center py-8">Loading…</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {[
                      { label: "Total GMV", value: `RM ${platStats.gmv.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: "Sum of paid orders" },
                      { label: "Promotion Revenue", value: `RM ${platStats.promoRevenue.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: "Approved promo fees" },
                      { label: "Total Orders", value: platStats.totalOrders.toLocaleString(), sub: "All time" },
                      { label: "Active Shops", value: `${activeShopCount}`, sub: "Live and approved" },
                      { label: "Registered Users", value: platStats.totalUsers.toLocaleString(), sub: "Total accounts" },
                      { label: "Avg Order Value", value: platStats.paidOrderCount > 0 ? `RM ${(platStats.gmv / platStats.paidOrderCount).toFixed(2)}` : "—", sub: "GMV ÷ paid orders" },
                    ].map((s) => (
                      <div key={s.label} className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                        <div className="text-xs text-stone-400 mb-1">{s.label}</div>
                        <div className="font-bold text-xl text-stone-900" style={{ fontFamily: "Lora, serif" }}>{s.value}</div>
                        <div className="text-xs text-stone-400">{s.sub}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h4 className="font-bold text-stone-700 text-sm mb-3">Growth Over Time</h4>
                <div className="h-36 bg-stone-50 rounded-xl border border-stone-100 flex items-center justify-center text-stone-300 text-sm">
                  📈 Connect analytics backend to display growth charts
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Reject Application</h3>
            <p className="text-sm text-stone-500 mb-3">Provide a reason — this will be sent to the applicant.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} placeholder="e.g., Please resubmit with a clearer shop description and valid contact information." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => rejectShop(rejectModal)} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600">Send Rejection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}