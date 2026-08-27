import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import Badge from "../components/ui/Badge";
import StarRating from "../components/ui/StarRating";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { slugify } from "../lib/marketData";
import {
  uploadImage,
  uploadProductImage,
  validateImageFile,
} from "../lib/uploadImage";
import {
  fetchPlatformPaymentInfo,
  sellerVerifyPayment,
  confirmPaymentBySeller,
  notifyAdminsPromoReceipt,
  notifySellerPromoStatus,
  notifyAdminsCommissionReceipt,
  type PlatformPaymentInfo,
} from "../lib/payments";
import {
  calculateCommissionOwed,
  formatPeriodMonth,
  getShopSalesSummary,
  startOfMonth,
  startOfNextMonth,
  startOfToday,
  startOfTomorrow,
  type SalesSummary,
} from "../lib/commissions";

type Tab = "overview" | "listings" | "orders" | "requests" | "analytics" | "earnings" | "settings" | "reviews";

const PROMOTION_TIERS = [
  { days: 3, amount: 5 },
  { days: 7, amount: 10 },
];

// ── Promotion modal steps ─────────────────────────────────────────────────────
type PromoStep = "tier" | "qr" | "receipt" | "submitted";

export default function SellerDashboard() {
  const { user, openAuthModal } = useApp();
  const { categories } = useCategories();
  const [tab, setTab] = useState<Tab>("overview");
  const [shop, setShop] = useState<any>(null);
  const [shopOpen, setShopOpen] = useState(true);
  const [shopInfo, setShopInfo] = useState({ name: "", category: "", bio: "", pickup_location: "" });
  const [shopInfoSaving, setShopInfoSaving] = useState(false);
  const [shopInfoError, setShopInfoError] = useState("");
  const [paused, setPaused] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [proposeModal, setProposeModal] = useState<string | null>(null);
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("");
  const [error, setError] = useState("");
  const [orderTab, setOrderTab] = useState<"pending" | "active" | "done">("pending");



  // Promotion modal
  const [promoteModal, setPromoteModal] = useState<string | null>(null);
  const [promotionDays, setPromotionDays] = useState(PROMOTION_TIERS[0].days);
  const [promoStep, setPromoStep] = useState<PromoStep>("tier");
  const [platformInfo, setPlatformInfo] = useState<PlatformPaymentInfo | null>(null);
  const [promoReceiptFile, setPromoReceiptFile] = useState<File | null>(null);
  const [promoReceiptPreview, setPromoReceiptPreview] = useState("");
  const [promoSubmitting, setPromoSubmitting] = useState(false);
  const [promoError, setPromoError] = useState("");
  const promoReceiptRef = useRef<HTMLInputElement>(null);

  // Commission settlement flow
  const [todayCommissionSales, setTodayCommissionSales] = useState<SalesSummary>({ orderCount: 0, totalSales: 0 });
  const [monthCommissionSales, setMonthCommissionSales] = useState<SalesSummary>({ orderCount: 0, totalSales: 0 });
  const [commissionSettlements, setCommissionSettlements] = useState<any[]>([]);
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionReceiptFile, setCommissionReceiptFile] = useState<File | null>(null);
  const [commissionReceiptPreview, setCommissionReceiptPreview] = useState("");
  const [commissionSubmitting, setCommissionSubmitting] = useState(false);
  const [commissionError, setCommissionError] = useState("");
  const commissionReceiptRef = useRef<HTMLInputElement>(null);

  // Add product/service
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: "", price: "", priceType: "Fixed price", category: "", description: "", whatIncluded: "",
    turnaroundNum: "3", turnaroundUnit: "Days",
    availDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], availStart: "09:00", availEnd: "18:00"
  });
  const [serviceImageFile, setServiceImageFile] = useState<File | null>(null);
  const [serviceImagePreview, setServiceImagePreview] = useState("");
  const [serviceImageError, setServiceImageError] = useState("");
  const [serviceImageUploading, setServiceImageUploading] = useState(false);
  const [deletingShop, setDeletingShop] = useState(false);
  const [editingListing, setEditingListing] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [productForm, setProductForm] = useState({ name: "", price: "", category: "", stock: "", description: "" });
  const [productImageFiles, setProductImageFiles] = useState<File[]>([]);
  const [productImagePreviews, setProductImagePreviews] = useState<string[]>([]);
  const [productImagesUploading, setProductImagesUploading] = useState(false);
  const [productImagesError, setProductImagesError] = useState("");

  // Shop image uploads
  const [logoPreview, setLogoPreview] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerError, setBannerError] = useState("");

  // Payment QR upload
  const [qrPreview, setQrPreview] = useState("");
  const [qrUploading, setQrUploading] = useState(false);
  const [qrError, setQrError] = useState("");

  // Deliver + collect payment confirm
  const [deliverConfirmModal, setDeliverConfirmModal] = useState<string | null>(null);
  const [paymentCollected, setPaymentCollected] = useState(false);
  const [paymentProofOrder, setPaymentProofOrder] = useState<any | null>(null);

  // Analytics
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [viewsThisWeek, setViewsThisWeek] = useState(0);
  const [topSellingItem, setTopSellingItem] = useState<{ name: string; qty: number } | null>(null);

  async function loadSellerData() {
    if (!user) return;
    const { data: shopRow } = await supabase
      .from("shops")
      .select("id,slug,name,category,bio,shop_type,is_open,is_paused,rating,review_count,pickup_location,logo_url,banner_url,payment_qr_url,bank_name,account_name,account_number,commission_per_order,status")
      .eq("owner_id", user.id)
      .eq("status", "approved")
      .is("deleted_at", null)
      .maybeSingle();

    setShop(shopRow);
    if (!shopRow) return;
    setShopOpen(Boolean(shopRow.is_open));
    setPaused(Boolean(shopRow.is_paused));
    setShopInfo({ name: shopRow.name || "", category: shopRow.category || "", bio: shopRow.bio || "", pickup_location: shopRow.pickup_location || "" });

    const monthStart = startOfMonth();
    const [{ data: products }, { data: services }, { data: orderRows }, { data: reviewRows }, todaySales, monthSales, { data: settlementRows }] = await Promise.all([
      supabase.from("products").select("id,name,price,category,description,images,stock_status,stock_count,slug,is_promoted,created_at").eq("shop_id", shopRow.id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("services").select("id,name,price,price_type,category,description,what_included,turnaround,availability,image,slug,is_promoted,created_at").eq("shop_id", shopRow.id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("orders").select("id,order_code,type,status,total,payment_status,payment_timing,payment_confirmed_by,payment_verified_by_seller,payment_proof_url,booking_date,booking_time,created_at,profiles(name,whatsapp),order_items(name,quantity)").eq("shop_id", shopRow.id).order("created_at", { ascending: false }),
      supabase.from("reviews").select("id,rating,text,created_at,profiles(name,avatar_url),products(name),services(name)").eq("shop_id", shopRow.id).order("created_at", { ascending: false }),
      getShopSalesSummary(shopRow.id, startOfToday(), startOfTomorrow()),
      getShopSalesSummary(shopRow.id, monthStart, startOfNextMonth(monthStart)),
      supabase.from("commission_settlements").select("*").eq("shop_id", shopRow.id).order("period_month", { ascending: false }),
    ]);

    setListings([
      ...(products ?? []).map((item: any) => ({ ...item, type: "product", promoted: Boolean(item.is_promoted) })),
      ...(services ?? []).map((item: any) => ({ ...item, type: "service", promoted: Boolean(item.is_promoted) })),
    ]);
    setOrders((orderRows ?? []).map((order: any) => ({
      id: order.id,
      code: order.order_code,
      buyer: order.profiles?.name || "Buyer",
      item: (order.order_items ?? []).map((i: any) => `${i.name} x${i.quantity}`).join(", "),
      total: Number(order.total || 0),
      status: order.status,
      payment_status: order.payment_status,
      payment_timing: order.payment_timing,
      payment_confirmed_by: order.payment_confirmed_by,
      payment_verified_by_seller: Boolean(order.payment_verified_by_seller),
      payment_proof_url: order.payment_proof_url || "",
      booking_date: order.booking_date || "",
      booking_time: order.booking_time || "",
      date: order.created_at ? new Date(order.created_at).toLocaleDateString("en-MY") : "",
      type: order.type,
      whatsapp: order.profiles?.whatsapp || "",
    })));
    setReviews((reviewRows ?? []).map((review: any) => ({
      id: review.id,
      author: review.profiles?.name || "AIU Student",
      avatar: review.profiles?.avatar_url || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&auto=format",
      rating: Number(review.rating || 0),
      date: review.created_at ? new Date(review.created_at).toLocaleDateString("en-MY") : "",
      text: review.text || "",
      product: review.products?.name || review.services?.name || "Shop order",
    })));
    setTodayCommissionSales(todaySales);
    setMonthCommissionSales(monthSales);
    setCommissionSettlements(settlementRows ?? []);
  }

  useEffect(() => { void loadSellerData(); }, [user?.id]);

  useEffect(() => {
    if (tab !== "analytics" || !shop?.id) return;
    async function loadAnalytics() {
      setAnalyticsLoading(true);
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const [{ count }, { data: items }] = await Promise.all([
        supabase
          .from("listing_views")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id)
          .gte("created_at", oneWeekAgo.toISOString()),
        supabase
          .from("order_items")
          .select("name,quantity,product_id,service_id,orders!inner(shop_id,status)")
          .eq("orders.shop_id", shop.id)
          .eq("orders.status", "completed"),
      ]);
      setViewsThisWeek(count ?? 0);
      const totals = new Map<string, { name: string; qty: number }>();
      for (const item of items ?? []) {
        const key = String(item.product_id || item.service_id || item.name);
        const existing = totals.get(key) ?? { name: item.name, qty: 0 };
        existing.qty += Number(item.quantity || 0);
        totals.set(key, existing);
      }
      setTopSellingItem([...totals.values()].sort((a, b) => b.qty - a.qty)[0] ?? null);
      setAnalyticsLoading(false);
    }
    void loadAnalytics();
  }, [tab, shop?.id]);

  // ── Auth / shop guards ───────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">Shop</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Sign in to access your dashboard</h2>
        <button onClick={() => openAuthModal("login")} className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium text-sm">Log in</button>
      </div>
    );
  }
  if (!shop) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>No approved shop yet</h2>
        <p className="text-sm text-stone-500 mb-4">Seller dashboard unlocks after an admin approves your shop application.</p>
        <Link to="/become-seller" className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium text-sm">Apply to sell</Link>
      </div>
    );
  }

  // ── Order actions ────────────────────────────────────────────────────────────
  
  async function handleProposeTime() {
    if (!proposeModal || !proposedDate || !proposedTime) return;
    const { error: err } = await supabase.from("orders").update({
      booking_date: proposedDate,
      booking_time: proposedTime,
      status: "pending_buyer_approval"
    }).eq("id", proposeModal);
    
    if (err) {
      setError(err.message);
      return;
    }
    setProposeModal(null);
    setProposedDate("");
    setProposedTime("");
    await loadSellerData();
  }

  async function updateOrderStatus(id: string, status: string, reason?: string) {
    const update: Record<string, string> = { status };
    if (reason) update.rejection_reason = reason;
    const { error: updateError } = await supabase.from("orders").update(update).eq("id", id);
    if (updateError) { setError(updateError.message); return; }
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  }

  async function handleVerifyPayment(orderId: string) {
    try {
      await sellerVerifyPayment(orderId);
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, payment_verified_by_seller: true } : o));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify payment");
    }
  }

  async function handleDeliverWithPayment(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    if (order.payment_timing === "on_pickup" && !paymentCollected) {
      setError("Please confirm you collected payment before marking as delivered.");
      return;
    }

    if (order.payment_timing === "on_pickup" && paymentCollected) {
      try {
        await confirmPaymentBySeller(orderId);
        setOrders((prev) => prev.map((o) =>
          o.id === orderId
            ? { ...o, status: "completed", payment_status: "paid", payment_confirmed_by: "seller", payment_verified_by_seller: true }
            : o
        ));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not update payment");
      }
    } else {
      await updateOrderStatus(orderId, "completed");
    }
    setDeliverConfirmModal(null);
    setPaymentCollected(false);
  }

  async function saveShopInfo() {
    if (!shop?.id || !shopInfo.name.trim() || !shopInfo.category.trim()) {
      setShopInfoError("Shop name and category are required.");
      return;
    }
    setShopInfoSaving(true);
    setShopInfoError("");
    const { error: saveError } = await supabase
      .from("shops")
      .update({
        name: shopInfo.name.trim(),
        category: shopInfo.category.trim(),
        bio: shopInfo.bio.trim(),
        pickup_location: shopInfo.pickup_location.trim(),
      })
      .eq("id", shop.id)
      .eq("owner_id", user!.id);
    if (saveError) {
      setShopInfoError(saveError.message);
    } else {
      setShop((prev: any) => ({ ...prev, name: shopInfo.name.trim(), category: shopInfo.category.trim(), bio: shopInfo.bio.trim(), pickup_location: shopInfo.pickup_location.trim() }));
    }
    setShopInfoSaving(false);
  }

  // ── Shop toggles ─────────────────────────────────────────────────────────────
  async function toggleShopOpen(nextOpen: boolean, nextPaused = false) {
    setShopOpen(nextOpen);
    setPaused(nextPaused);
    await supabase.from("shops").update({ is_open: nextOpen, is_paused: nextPaused }).eq("id", shop.id);
  }

  // ── Product form ─────────────────────────────────────────────────────────────
  function openEditListing(item: any) {
    setEditingListing({
      ...item,
      name: item.name || "",
      price: String(item.price ?? ""),
      category: item.category || "",
      stock: String(item.stock_count ?? 0),
      description: item.description || "",
    });
  }

  function closeEditListing() {
    setEditingListing(null);
    setEditSaving(false);
  }

  async function saveListingEdit() {
    if (!editingListing?.name || !editingListing?.price) return;
    setEditSaving(true);
    const table = editingListing.type === "service" ? "services" : "products";
    const payload: Record<string, any> = {
      name: editingListing.name.trim(),
      price: Number(editingListing.price),
      category: editingListing.category,
      description: editingListing.description,
    };
    if (editingListing.type === "service") {
      payload.price_type = editingListing.price_type || "Fixed price";
      payload.what_included = editingListing.what_included || "";
      payload.turnaround = editingListing.turnaround || "";
      payload.availability = editingListing.availability || "available";
    }
    if (editingListing.type === "product") {
      payload.stock_count = Number(editingListing.stock || 0);
      payload.stock_status = payload.stock_count > 0 ? "in_stock" : "made_to_order";
    }
    const { error: updateError } = await supabase.from(table).update(payload).eq("id", editingListing.id).eq("shop_id", shop.id);
    if (updateError) {
      setError(updateError.message);
      setEditSaving(false);
      return;
    }
    closeEditListing();
    await loadSellerData();
  }

  async function removeListing(item: any) {
    const confirmed = window.confirm(
      `Remove "${item.name}" from your listings? It will disappear from the marketplace, but previous order records will be kept.`
    );
    if (!confirmed) return;

    setError("");

    const table = item.type === "service" ? "services" : "products";

    // Soft-delete the listing instead of physically deleting it.
    // This keeps old order_items.product_id / service_id references valid.
    const { error: removeError } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("shop_id", shop.id);

    if (removeError) {
      setError(removeError.message);
      return;
    }

    setListings((prev) =>
      prev.filter(
        (row) => !(row.id === item.id && row.type === item.type)
      )
    );
  }

  function closeAddService() {
    setAddServiceOpen(false);
    setServiceForm({
      name: "", price: "", priceType: "Fixed price", category: "", description: "", whatIncluded: "",
      turnaroundNum: "3", turnaroundUnit: "Days",
      availDays: ["Mon", "Tue", "Wed", "Thu", "Fri"], availStart: "09:00", availEnd: "18:00"
    });
    setServiceImageFile(null);
    setServiceImagePreview((prev) => { if (prev) URL.revokeObjectURL(prev); return ""; });
    setServiceImageError("");
  }

  async function handleAddService() {
    if (!serviceForm.name || !serviceForm.price || !serviceForm.category || !serviceForm.description || !serviceForm.whatIncluded || !serviceForm.turnaroundNum || serviceForm.availDays.length === 0 || !serviceForm.availStart || !serviceForm.availEnd) {
      setError("Please complete all required service fields.");
      return;
    }
    const slug = `${slugify(serviceForm.name)}-${Date.now().toString(36)}`;
    setServiceImageUploading(Boolean(serviceImageFile));
    
    const combinedTurnaround = `${serviceForm.turnaroundNum} ${serviceForm.turnaroundUnit}`;
    const structuredAvailability = JSON.stringify({
      days: serviceForm.availDays,
      start: serviceForm.availStart,
      end: serviceForm.availEnd
    });

    const { data: newService, error: insertError } = await supabase.from("services").insert({
      shop_id: shop.id, slug, name: serviceForm.name.trim(), description: serviceForm.description.trim(),
      what_included: serviceForm.whatIncluded.trim(), price: Number(serviceForm.price), price_type: serviceForm.priceType,
      turnaround: combinedTurnaround, category: serviceForm.category, availability: structuredAvailability, image: null,
    }).select("id").single();
    if (insertError || !newService) { setServiceImageUploading(false); setError(insertError?.message || "Could not create service"); return; }
    if (serviceImageFile) {
      try {
        const ext = serviceImageFile.name.split(".").pop() || "jpg";
        const url = await uploadImage("service-images", `${shop.id}/${newService.id}.${ext}`, serviceImageFile);
        await supabase.from("services").update({ image: url }).eq("id", newService.id).eq("shop_id", shop.id);
      } catch (e) { setServiceImageError(e instanceof Error ? e.message : "Service image upload failed."); }
    }
    setServiceImageUploading(false);
    closeAddService();
    await loadSellerData();
  }

  async function deleteShop() {
    if (!window.confirm("Delete your shop? Your shop will be permanently removed from the marketplace and can no longer receive new orders. Existing transaction records are retained.")) return;
    setDeletingShop(true);
    setError("");
    const { error: deleteError } = await supabase.from("shops").update({ deleted_at: new Date().toISOString(), is_open: false, is_paused: true }).eq("id", shop.id).eq("owner_id", user!.id);
    if (deleteError) { setError(deleteError.message); setDeletingShop(false); return; }
    await supabase.from("profiles").update({ has_shop: false }).eq("id", user!.id);
    setDeletingShop(false);
    window.location.href = "/";
  }

  function closeAddProduct() {
    setAddProductOpen(false);
    setProductForm({ name: "", price: "", category: "", stock: "", description: "" });
    setProductImagesError("");
    setProductImageFiles([]);
    setProductImagePreviews((prev) => { prev.forEach((url) => URL.revokeObjectURL(url)); return []; });
  }

  function handleProductImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const validFiles: File[] = [];
    const errs: string[] = [];
    for (const file of files) {
      const err = validateImageFile(file);
      if (err) errs.push(`${file.name}: ${err}`);
      else validFiles.push(file);
    }
    setProductImagesError(errs.join(" | "));
    setProductImageFiles((prev) => [...prev, ...validFiles]);
    setProductImagePreviews((prev) => [...prev, ...validFiles.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeProductImage(index: number) {
    setProductImageFiles((prev) => prev.filter((_, i) => i !== index));
    setProductImagePreviews((prev) => { URL.revokeObjectURL(prev[index]); return prev.filter((_, i) => i !== index); });
  }

  async function handleAddProduct() {
    if (!productForm.name || !productForm.price) return;
    const slug = `${slugify(productForm.name)}-${Date.now().toString(36)}`;
    const { data: newProduct, error: insertError } = await supabase.from("products").insert({
      shop_id: shop.id, slug, name: productForm.name, description: productForm.description,
      price: Number(productForm.price), category: productForm.category,
      stock_status: Number(productForm.stock || 0) > 0 ? "in_stock" : "made_to_order",
      stock_count: Number(productForm.stock || 0), images: [],
    }).select("id").single();
    if (insertError || !newProduct) { setError(insertError?.message || "Could not create product"); return; }

    if (productImageFiles.length > 0) {
      setProductImagesUploading(true);
      setProductImagesError("");
      const urls: string[] = [];
      for (let i = 0; i < productImageFiles.length; i++) {
            const file = productImageFiles[i];
        try {
          const url = await uploadProductImage(
  file,
  shop.id,
  newProduct.id
);
          urls.push(url);
        } catch (uploadErr) {
          setProductImagesError(uploadErr instanceof Error ? uploadErr.message : "Some images failed to upload.");
        }
      }
      setProductImagesUploading(false);
      if (urls.length > 0) {
        const { error: imageSaveError } = await supabase
          .from("products")
          .update({ images: urls })
          .eq("id", newProduct.id);
        if (imageSaveError) {
          setProductImagesError(`Images uploaded, but could not be saved to the listing: ${imageSaveError.message}`);
        }
      }
    }
    closeAddProduct();
    setTab("listings");
    await loadSellerData();
  }

  // ── Shop image uploads ────────────────────────────────────────────────────────
  async function handleShopLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setLogoError(err); return; }
    setLogoError(""); setLogoPreview(URL.createObjectURL(file)); setLogoUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const url = await uploadImage("shop-logos", `${shop.id}/logo-${Date.now()}.${ext}`, file);
      const { error: saveError } = await supabase.from("shops").update({ logo_url: url }).eq("id", shop.id);
      if (saveError) throw new Error(`Logo uploaded, but could not be saved to your shop: ${saveError.message}`);
      setShop((prev: any) => ({ ...prev, logo_url: url }));
    } catch (uploadErr) { setLogoError(uploadErr instanceof Error ? uploadErr.message : "Logo upload failed."); }
    finally { setLogoUploading(false); e.target.value = ""; }
  }

  async function handleShopBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setBannerError(err); return; }
    setBannerError(""); setBannerPreview(URL.createObjectURL(file)); setBannerUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const url = await uploadImage("shop-banners", `${shop.id}/banner-${Date.now()}.${ext}`, file);
      const { error: saveError } = await supabase.from("shops").update({ banner_url: url }).eq("id", shop.id);
      if (saveError) throw new Error(`Banner uploaded, but could not be saved to your shop: ${saveError.message}`);
      setShop((prev: any) => ({ ...prev, banner_url: url }));
    } catch (uploadErr) { setBannerError(uploadErr instanceof Error ? uploadErr.message : "Banner upload failed."); }
    finally { setBannerUploading(false); e.target.value = ""; }
  }

  async function handlePaymentQrChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateImageFile(file);
    if (err) { setQrError(err); return; }
    setQrError(""); setQrPreview(URL.createObjectURL(file)); setQrUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const url = await uploadImage("payment-qr", `${shop.id}/qr-${Date.now()}.${ext}`, file);
      const { error: saveError } = await supabase.from("shops").update({ payment_qr_url: url }).eq("id", shop.id);
      if (saveError) throw new Error(`QR uploaded, but could not be saved to your shop: ${saveError.message}`);
      setShop((prev: any) => ({ ...prev, payment_qr_url: url }));
    } catch (uploadErr) { setQrError(uploadErr instanceof Error ? uploadErr.message : "QR upload failed."); }
    finally { setQrUploading(false); e.target.value = ""; }
  }

  // ── Promotion flow ────────────────────────────────────────────────────────────
  async function openPromoteModal(key: string) {
    setPromoteModal(key);
    setPromoStep("tier");
    setPromoReceiptFile(null);
    setPromoReceiptPreview("");
    setPromoError("");
    const info = await fetchPlatformPaymentInfo();
    setPlatformInfo(info);
  }

  async function handleSubmitPromotion() {
    if (!user || !promoteModal) return;
    const [listingType, listingId] = promoteModal.split(":") as ["product" | "service", string];
    const tier = PROMOTION_TIERS.find((t) => t.days === promotionDays) ?? PROMOTION_TIERS[0];
    const listing = listings.find((l) => l.id === listingId && l.type === listingType);
    setPromoSubmitting(true);
    setPromoError("");

    let receiptUrl: string | null = null;
    if (promoReceiptFile) {
      try {
        const ext = promoReceiptFile.name.split(".").pop() || "jpg";
        receiptUrl = await uploadImage(
          "promotion-receipts",
          `${shop.id}/${listingType}-${listingId}-${Date.now()}.${ext}`,
          promoReceiptFile
        );
      } catch (uploadErr) {
        setPromoError(uploadErr instanceof Error ? uploadErr.message : "Receipt upload failed.");
        setPromoSubmitting(false);
        return;
      }
    }

    const { error: insertError } = await supabase.from("listing_promotions").insert({
      shop_id: shop.id,
      listing_type: listingType,
      listing_id: listingId,
      duration_days: tier.days,
      amount: tier.amount,
      receipt_url: receiptUrl,
    });

    if (insertError) {
      setPromoError(insertError.message);
      setPromoSubmitting(false);
      return;
    }

    await notifyAdminsPromoReceipt(shop.name, listing?.name ?? "listing", tier.amount);
    setPromoSubmitting(false);
    setPromoStep("submitted");
  }

  // ── Overview cards ────────────────────────────────────────────────────────────
  async function openCommissionModal() {
    setCommissionModalOpen(true);
    setCommissionReceiptFile(null);
    setCommissionReceiptPreview("");
    setCommissionError("");
    const info = await fetchPlatformPaymentInfo();
    setPlatformInfo(info);
  }

  async function handleSubmitCommissionSettlement() {
    if (!shop || !commissionReceiptFile) return;
    setCommissionSubmitting(true);
    setCommissionError("");

    const amountOwed = calculateCommissionOwed(monthCommissionSales.orderCount, Number(shop.commission_per_order || 0));
    const periodMonth = formatPeriodMonth(startOfMonth());
    let receiptUrl = "";

    try {
      const ext = commissionReceiptFile.name.split(".").pop() || "jpg";
      receiptUrl = await uploadImage(
        "commission-receipts",
        `${shop.id}/commission-${periodMonth}-${Date.now()}.${ext}`,
        commissionReceiptFile
      );
    } catch (uploadErr) {
      setCommissionError(uploadErr instanceof Error ? uploadErr.message : "Receipt upload failed.");
      setCommissionSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("commission_settlements").insert({
      shop_id: shop.id,
      period_month: periodMonth,
      order_count: monthCommissionSales.orderCount,
      amount_owed: amountOwed,
      receipt_url: receiptUrl,
      submitted_at: new Date().toISOString(),
    });

    if (insertError) {
      setCommissionError(insertError.message);
      setCommissionSubmitting(false);
      return;
    }

    await notifyAdminsCommissionReceipt(shop.name, amountOwed);
    setCommissionSubmitting(false);
    setCommissionModalOpen(false);
    setCommissionReceiptFile(null);
    setCommissionReceiptPreview("");
    await loadSellerData();
  }

  const completedOrders = orders.filter((o) => o.status === "completed");
  const totalSales = completedOrders.reduce((sum, o) => sum + o.total, 0);
  const productSales = completedOrders.filter((o) => o.type === "product").reduce((sum, o) => sum + o.total, 0);
  const serviceSales = completedOrders.filter((o) => o.type === "service").reduce((sum, o) => sum + o.total, 0);
  const commissionPerOrder = Number(shop.commission_per_order || 0);
  const currentCommissionOwed = calculateCommissionOwed(monthCommissionSales.orderCount, commissionPerOrder);
  const currentPeriodMonth = formatPeriodMonth(startOfMonth());
  const currentSettlement = commissionSettlements.find((settlement) => settlement.period_month === currentPeriodMonth);

  const overviewCards = [
    { label: "Total Sales", value: `RM ${totalSales.toFixed(2)}`, trend: "Completed orders" },
    { label: "Pending Orders", value: orders.filter((o) => o.status === "pending").length.toString(), trend: "Needs attention" },
    { label: "Listings", value: listings.length.toString(), trend: "Products and services" },
    { label: "Rating", value: `${Number(shop.rating ?? 0).toFixed(1)} ★`, trend: `${reviews.length} reviews` },
  ];

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "overview", label: "Overview", icon: "Stats" },
    { id: "listings", label: "Listings", icon: "List" },
    { id: "orders", label: "Orders", icon: "Orders" },
    { id: "requests", label: "Service Requests", icon: "Calendar" },
    { id: "analytics", label: "Analytics", icon: "Chart" },
    { id: "earnings", label: "Earnings", icon: "RM" },
    { id: "reviews", label: "Reviews", icon: "Star" },
    { id: "settings", label: "Settings", icon: "Gear" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Seller Dashboard</h1>
          <p className="text-stone-500 text-sm mt-0.5">{shop.name} — <span className={shopOpen && !paused ? "text-green-600" : "text-red-500"}>{paused ? "Paused" : shopOpen ? "Open" : "Closed"}</span></p>
        </div>
        <div className="flex gap-2">
          <Link to={`/shop/${shop.slug}`} className="px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-50 transition-colors">View My Shop</Link>
          <button onClick={() => (shop.shop_type === "service" ? setAddServiceOpen(true) : setAddProductOpen(true))} className="px-4 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-semibold hover:bg-[#0F1F4A] transition-colors">+ Add Listing</button>
        </div>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{error}</div>}

      {/* Tab bar */}
      <div className="lg:hidden hide-scrollbar flex gap-1 overflow-x-auto bg-white border border-stone-100 rounded-xl p-1 mb-4">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${tab === t.id ? "bg-[#1C3270] text-white" : "text-stone-500 hover:text-stone-700"}`}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <nav className="hidden lg:block lg:col-span-1">
          <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left border-b border-stone-50 last:border-0 ${tab === t.id ? "bg-[#1C3270]/5 text-[#1C3270] border-l-2 border-l-[#1C3270]" : "text-stone-600 hover:bg-stone-50"}`}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="lg:col-span-4">
          {/* ── Overview ─────────────────────────────────────────────────────── */}
          {tab === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {overviewCards.map((card) => (
                  <div key={card.label} className="bg-white rounded-xl border border-stone-100 p-4">
                    <div className="flex items-center gap-2 mb-2"><span className="text-xs text-stone-400 font-medium">{card.label}</span></div>
                    <div className="font-bold text-xl text-stone-900" style={{ fontFamily: "Lora, serif" }}>{card.value}</div>
                    <div className="text-xs text-stone-400 mt-0.5">{card.trend}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Listings ─────────────────────────────────────────────────────── */}
          {tab === "listings" && (
            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
                <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>My Listings</h3>
                <div className="flex gap-2">
                  {shop.shop_type !== "service" && <button onClick={() => setAddProductOpen(true)} className="px-3 py-2 bg-[#1C3270] text-white rounded-lg text-xs font-medium hover:bg-[#0F1F4A] transition-colors">+ Product</button>}
                  {shop.shop_type !== "product" && <button onClick={() => setAddServiceOpen(true)} className="px-3 py-2 bg-[#44B444] text-white rounded-lg text-xs font-medium hover:bg-[#2E8A2E] transition-colors">+ Service</button>}
                </div>
              </div>
              <div className="divide-y divide-stone-50">
                {listings.length === 0 ? <div className="p-8 text-sm text-stone-500 text-center">No listings yet.</div> : listings.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex items-start gap-3 px-5 py-4">
                    {/* Thumbnail */}
                    <div className="w-11 h-11 bg-stone-100 rounded-lg overflow-hidden flex-shrink-0 mt-0.5">
                      {(item.images?.[0] || item.image)
                        ? <img src={item.images?.[0] ?? item.image} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs">📦</div>}
                    </div>
                    {/* Info + actions */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm text-stone-900 line-clamp-1">{item.name}</div>
                          <div className="text-xs text-stone-400 mt-0.5">{item.type === "service" ? "Service" : "Product"} · {item.category}</div>
                        </div>
                        <div className="text-sm font-bold text-[#1C3270] flex-shrink-0 mt-0.5">RM {Number(item.price).toFixed(2)}</div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {item.promoted && <Badge variant="promoted" />}
                        <button
                          onClick={() => openEditListing(item)}
                          className="text-xs px-2.5 py-1 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void removeListing(item)}
                          className="text-xs px-2.5 py-1 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                        <button onClick={() => void openPromoteModal(`${item.type}:${item.id}`)} className="text-xs px-2.5 py-1 border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors">Promote</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Orders ───────────────────────────────────────────────────────── */}
          {tab === "orders" && (() => {
            const productOrders = orders.filter((o) => o.type === "product");
            const pendingOrders = productOrders.filter((o) => o.status === "pending");
            const activeOrders = productOrders.filter((o) => ["confirmed", "ready"].includes(o.status));
            const doneOrders = productOrders.filter((o) => ["completed", "cancelled", "rejected"].includes(o.status));
            const visibleOrders = orderTab === "pending" ? pendingOrders : orderTab === "active" ? activeOrders : doneOrders;
            return (
              <div className="space-y-4">
                {/* Sub-tabs */}
                <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit">
                  {([
                    { key: "pending" as const, label: "Pending", count: pendingOrders.length, color: "text-amber-600" },
                    { key: "active" as const, label: "Active", count: activeOrders.length, color: "text-blue-600" },
                    { key: "done" as const, label: "Completed", count: doneOrders.length, color: "text-stone-500" },
                  ]).map(({ key, label, count, color }) => (
                    <button
                      key={key}
                      onClick={() => setOrderTab(key)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${orderTab === key ? "bg-white shadow-sm text-[#1C3270]" : "text-stone-500 hover:text-stone-700"}`}
                    >
                      {label}
                      {count > 0 && (
                        <span className={`ml-1.5 text-xs font-bold ${orderTab === key ? color : "opacity-50"}`}>
                          ({count})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Order cards */}
                {visibleOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
                    <div className="text-3xl mb-2">{orderTab === "pending" ? "⏳" : orderTab === "active" ? "📦" : "✅"}</div>
                    <div className="text-sm text-stone-500">
                      {orderTab === "pending" ? "No pending orders — all caught up!" : orderTab === "active" ? "No active orders in progress." : "No completed orders yet."}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleOrders.map((order) => (
                      <div key={order.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-semibold text-stone-900 text-sm">{order.buyer}</span>
                            <span className="mx-2 text-stone-300">—</span>
                            <span className="font-mono text-xs text-stone-400">{order.code}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={order.status as any} />
                            {order.payment_timing === "on_pickup" && order.payment_status !== "paid" && (
                              <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">💵 Cash/QR on pickup</span>
                            )}
                            {order.payment_confirmed_by === "buyer" && !order.payment_verified_by_seller && (
                              <Badge variant="payment_reported" />
                            )}
                            {order.payment_verified_by_seller && (
                              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">✓ Payment verified</span>
                            )}
                          </div>
                        </div>

                        <div className="px-5 py-4">
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-stone-700">{order.item}</span>
                            <span className="font-bold text-[#1C3270]">RM {order.total.toFixed(2)}</span>
                          </div>
                          <div className="text-xs text-stone-400 mb-3">{order.date} — {order.type === "service" ? "Service Booking" : "Product Order"}</div>
                          {order.type === "service" && (order.booking_date || order.booking_time) && (
                            <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
                              <span className="font-semibold">Requested time:</span> {order.booking_date ? new Date(`${order.booking_date}T00:00:00`).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Date not set"}{order.booking_time ? ` at ${order.booking_time}` : ""}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {order.status === "pending" && (
                              <>
                                <button onClick={() => updateOrderStatus(order.id, "confirmed")} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">Accept</button>
                                <button onClick={() => setRejectModal(order.id)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600">Reject</button>
                              </>
                            )}
                            {order.status === "confirmed" && (
                              <button onClick={() => updateOrderStatus(order.id, "ready")} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700">Mark as Ready</button>
                            )}
                            {order.status === "ready" && (
                              <button
                                onClick={() => { setPaymentCollected(false); setDeliverConfirmModal(order.id); }}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
                              >
                                Mark as Delivered
                              </button>
                            )}
                            {order.payment_proof_url && (
                              <button
                                onClick={() => setPaymentProofOrder(order)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                              >
                                📷 View Payment Proof
                              </button>
                            )}
                            {order.payment_confirmed_by === "buyer" && !order.payment_verified_by_seller && (
                              <button
                                onClick={() => void handleVerifyPayment(order.id)}
                                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600"
                              >
                                ✓ Verify Payment Received
                              </button>
                            )}
                            {order.whatsapp && (
                              <a href={`https://wa.me/${order.whatsapp}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-semibold hover:bg-[#1ebe5d]">
                                Message Buyer
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Service Requests ─────────────────────────────────────────────── */}
          {tab === "requests" && (() => {
            const serviceOrders = orders.filter((o) => o.type === "service");
            const pendingOrders = serviceOrders.filter((o) => o.status === "pending" || o.status === "pending_buyer_approval");
            const activeOrders = serviceOrders.filter((o) => ["confirmed", "ready"].includes(o.status));
            const doneOrders = serviceOrders.filter((o) => ["completed", "cancelled", "rejected"].includes(o.status));
            const visibleOrders = orderTab === "pending" ? pendingOrders : orderTab === "active" ? activeOrders : doneOrders;
            return (
              <div className="space-y-4">
                <div className="flex gap-1 bg-stone-100 rounded-xl p-1 w-fit">
                  {([
                    { key: "pending" as const, label: "Requests", count: pendingOrders.length, color: "text-amber-600" },
                    { key: "active" as const, label: "Active", count: activeOrders.length, color: "text-blue-600" },
                    { key: "done" as const, label: "Completed", count: doneOrders.length, color: "text-stone-500" },
                  ]).map(({ key, label, count, color }) => (
                    <button
                      key={key}
                      onClick={() => setOrderTab(key)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${orderTab === key ? "bg-white shadow-sm text-[#1C3270]" : "text-stone-500 hover:text-stone-700"}`}
                    >
                      {label}
                      {count > 0 && (
                        <span className={`ml-1.5 text-xs font-bold ${orderTab === key ? color : "opacity-50"}`}>
                          ({count})
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {visibleOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-100 p-10 text-center">
                    <div className="text-3xl mb-2">{orderTab === "pending" ? "📅" : orderTab === "active" ? "⚙️" : "✅"}</div>
                    <div className="text-sm text-stone-500">
                      {orderTab === "pending" ? "No pending service requests." : orderTab === "active" ? "No active services." : "No completed services yet."}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleOrders.map((order) => (
                      <div key={order.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
                        <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <span className="font-semibold text-stone-900 text-sm">{order.buyer}</span>
                            <span className="mx-2 text-stone-300">—</span>
                            <span className="font-mono text-xs text-stone-400">{order.code}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={order.status as any} />
                            {order.status === "pending_buyer_approval" && (
                              <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">Counter-offer sent</span>
                            )}
                          </div>
                        </div>

                        <div className="px-5 py-4">
                          <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-stone-700">{order.item}</span>
                            <span className="font-bold text-[#1C3270]">RM {order.total.toFixed(2)}</span>
                          </div>
                          
                          {(order.booking_date || order.booking_time) && (
                            <div className={`mb-3 p-3 border rounded-xl text-sm ${order.status === 'pending_buyer_approval' ? 'bg-purple-50 border-purple-100 text-purple-800' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                              <span className="font-semibold">{order.status === 'pending_buyer_approval' ? 'Proposed time:' : 'Requested time:'}</span> {order.booking_date ? new Date(`${order.booking_date}T00:00:00`).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Date not set"}{order.booking_time ? ` at ${order.booking_time}` : ""}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2">
                            {order.status === "pending" && (
                              <>
                                <button onClick={() => updateOrderStatus(order.id, "confirmed")} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">Accept Request</button>
                                <button onClick={() => setProposeModal(order.id)} className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-semibold hover:bg-purple-700">Propose New Time</button>
                                <button onClick={() => setRejectModal(order.id)} className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-semibold hover:bg-red-600">Decline Request</button>
                              </>
                            )}
                            {order.status === "confirmed" && (
                              <button
                                onClick={() => { setPaymentCollected(false); setDeliverConfirmModal(order.id); }}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
                              >
                                Mark as Completed
                              </button>
                            )}
                            {order.whatsapp && (
                              <a href={`https://wa.me/${order.whatsapp}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-[#25D366] text-white rounded-lg text-xs font-semibold hover:bg-[#1ebe5d]">
                                Message Buyer
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}


          {/* ── Reviews ──────────────────────────────────────────────────────── */}
          {tab === "reviews" && (
            <div className="space-y-4">
              {reviews.length === 0 ? <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center text-sm text-stone-500">No reviews yet.</div> : reviews.map((review) => (
                <div key={review.id} className="bg-white rounded-2xl border border-stone-100 p-5">
                  <div className="flex items-start gap-3">
                    <img src={review.avatar} alt={review.author} className="w-9 h-9 rounded-full object-cover" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1"><span className="font-semibold text-sm text-stone-900">{review.author}</span><StarRating rating={review.rating} size="sm" /><span className="text-xs text-stone-400">{review.date}</span></div>
                      <p className="text-sm text-stone-600">{review.text}</p>
                      <p className="text-xs text-stone-400 mt-1">Re: {review.product}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Earnings ─────────────────────────────────────────────────────── */}
          {tab === "earnings" && (
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>Earnings Summary</h3>
                <p className="text-xs text-stone-400 mb-5">Payments go directly to you — this is a reference total only, not a withdrawable balance.</p>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Total Sales", value: `RM ${totalSales.toFixed(2)}`, sub: "All completed orders" },
                    { label: "Products", value: `RM ${productSales.toFixed(2)}`, sub: "Product orders" },
                    { label: "Services", value: `RM ${serviceSales.toFixed(2)}`, sub: "Service bookings" },
                  ].map((s) => (
                    <div key={s.label} className="p-4 bg-stone-50 rounded-xl border border-stone-100 text-center">
                      <div className="text-xs text-stone-400 mb-1">{s.label}</div>
                      <div className="font-bold text-lg text-[#1C3270]" style={{ fontFamily: "Lora, serif" }}>{s.value}</div>
                      <div className="text-xs text-stone-400">{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                  💡 Since buyers pay you directly (via QR or bank transfer), your earnings are already in your account. This dashboard shows your sales reference for tracking purposes.
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h4 className="font-bold text-stone-700 text-sm mb-3">Completed Orders</h4>
                {completedOrders.length === 0
                  ? <div className="text-sm text-stone-400">No completed orders yet.</div>
                  : <div className="space-y-2">
                    {completedOrders.map((o) => (
                      <div key={o.id} className="flex justify-between text-sm py-2 border-b border-stone-50">
                        <span className="text-stone-700">{o.item}</span>
                        <span className="font-semibold text-stone-900">RM {o.total.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                }
              </div>
              <div className="bg-white rounded-2xl border border-amber-100 p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>Sales &amp; Commission</h3>
                    <p className="text-xs text-stone-400">This tracks what your shop owes the platform, separate from your own earnings.</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-stone-400">Commission per order</div>
                    <div className="font-bold text-[#1C3270]">RM {commissionPerOrder.toFixed(2)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  {[
                    { label: "Today's sales", value: `RM ${todayCommissionSales.totalSales.toFixed(2)}`, sub: `${todayCommissionSales.orderCount} paid completed orders` },
                    { label: "This month", value: `RM ${monthCommissionSales.totalSales.toFixed(2)}`, sub: `${monthCommissionSales.orderCount} paid completed orders` },
                    { label: "Owed this month", value: `RM ${currentCommissionOwed.toFixed(2)}`, sub: `${monthCommissionSales.orderCount} x RM ${commissionPerOrder.toFixed(2)}` },
                  ].map((s) => (
                    <div key={s.label} className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="text-xs text-stone-500 mb-1">{s.label}</div>
                      <div className="font-bold text-lg text-stone-900" style={{ fontFamily: "Lora, serif" }}>{s.value}</div>
                      <div className="text-xs text-stone-500">{s.sub}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-stone-100 bg-stone-50 p-4 text-sm text-stone-700 mb-4">
                  You owe <strong>RM {currentCommissionOwed.toFixed(2)}</strong> to AIU Campus Market this month based on {monthCommissionSales.orderCount} completed paid orders.
                </div>
                {currentSettlement ? (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                    Current month settlement: <strong className="capitalize">{currentSettlement.status}</strong>
                    {currentSettlement.rejection_reason ? ` - ${currentSettlement.rejection_reason}` : ""}
                  </div>
                ) : (
                  <button
                    onClick={() => void openCommissionModal()}
                    disabled={currentCommissionOwed <= 0}
                    className="px-5 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-semibold hover:bg-[#0F1F4A] disabled:opacity-50"
                  >
                    Pay This Month&apos;s Amount
                  </button>
                )}
                {commissionSettlements.length > 0 && (
                  <div className="mt-5">
                    <h4 className="font-bold text-stone-700 text-sm mb-2">Settlement History</h4>
                    <div className="space-y-2">
                      {commissionSettlements.map((settlement) => (
                        <div key={settlement.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 bg-white px-3 py-2 text-sm">
                          <div>
                            <div className="font-medium text-stone-800">{new Date(settlement.period_month).toLocaleDateString("en-MY", { month: "long", year: "numeric" })}</div>
                            <div className="text-xs text-stone-400">{settlement.order_count} orders</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-[#1C3270]">RM {Number(settlement.amount_owed || 0).toFixed(2)}</div>
                            <div className="text-xs capitalize text-stone-500">{settlement.status}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "analytics" && (
            <div className="bg-white rounded-2xl border border-stone-100 p-6">
              <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>Shop Analytics</h3>
              <p className="text-xs text-stone-400 mb-5">Lightweight stats from real listing views and completed orders.</p>
              {analyticsLoading ? (
                <div className="text-sm text-stone-400 text-center py-8">Loading analytics…</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                    <div className="text-xs text-stone-400 mb-1">Views this week</div>
                    <div className="font-bold text-2xl text-stone-900" style={{ fontFamily: "Lora, serif" }}>{viewsThisWeek.toLocaleString()}</div>
                    <div className="text-xs text-stone-400 mt-1">Product &amp; service page visits</div>
                  </div>
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                    <div className="text-xs text-stone-400 mb-1">Top-selling item</div>
                    {topSellingItem ? (
                      <>
                        <div className="font-bold text-lg text-stone-900 line-clamp-2" style={{ fontFamily: "Lora, serif" }}>{topSellingItem.name}</div>
                        <div className="text-xs text-stone-400 mt-1">{topSellingItem.qty} sold across completed orders</div>
                      </>
                    ) : (
                      <>
                        <div className="font-bold text-lg text-stone-400" style={{ fontFamily: "Lora, serif" }}>—</div>
                        <div className="text-xs text-stone-400 mt-1">No completed orders yet</div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Settings ─────────────────────────────────────────────────────── */}
          {tab === "settings" && (
            <div className="space-y-4">
              {/* Shop Information */}
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>Shop Information</h3>
                <p className="text-xs text-stone-400 mb-4">Edit the information buyers see on your shop page.</p>
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium text-stone-600 mb-1">Shop Name *</label><input value={shopInfo.name} onChange={(e) => setShopInfo((v) => ({ ...v, name: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" /></div>
                  <div><label className="block text-xs font-medium text-stone-600 mb-1">Category *</label><select value={shopInfo.category} onChange={(e) => setShopInfo((v) => ({ ...v, category: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option value="">Select a category</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-stone-600 mb-1">About / Shop Description</label><textarea value={shopInfo.bio} onChange={(e) => setShopInfo((v) => ({ ...v, bio: e.target.value }))} rows={4} placeholder="Tell buyers what your shop sells, what makes it useful, and what they can expect." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 resize-none" /></div>
                  <div><label className="block text-xs font-medium text-stone-600 mb-1">Pickup / Meeting Location</label><input value={shopInfo.pickup_location} onChange={(e) => setShopInfo((v) => ({ ...v, pickup_location: e.target.value }))} placeholder="e.g. AIU Main Campus" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" /></div>
                  {shopInfoError && <p className="text-xs text-red-500">{shopInfoError}</p>}
                  <button onClick={() => void saveShopInfo()} disabled={shopInfoSaving} className="px-4 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-semibold hover:bg-[#0F1F4A] disabled:opacity-50">{shopInfoSaving ? "Saving…" : "Save Shop Information"}</button>
                </div>
              </div>

              {/* Shop Status */}
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h3 className="font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>Shop Status</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div><div className="font-medium text-stone-900 text-sm">Shop Open</div><div className="text-xs text-stone-400">Customers can place orders</div></div>
                    <div className="relative" onClick={() => toggleShopOpen(!shopOpen, false)}><div className={`w-12 h-6 rounded-full transition-colors ${shopOpen && !paused ? "bg-[#1C3270]" : "bg-stone-200"}`} /><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${shopOpen && !paused ? "translate-x-6" : ""}`} /></div>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div><div className="font-medium text-stone-900 text-sm">Vacation / Pause Mode</div><div className="text-xs text-stone-400">Temporarily pause without closing permanently.</div></div>
                    <div className="relative" onClick={() => toggleShopOpen(shopOpen, !paused)}><div className={`w-12 h-6 rounded-full transition-colors ${paused ? "bg-amber-400" : "bg-stone-200"}`} /><div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${paused ? "translate-x-6" : ""}`} /></div>
                  </label>
                </div>
              </div>

              {/* Payment QR */}
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>Payment QR Code</h3>
                <p className="text-xs text-stone-400 mb-4">Upload your TnG or DuitNow "Receive Money" QR code. Buyers will scan this to pay you directly.</p>
                <div className="flex items-start gap-4">
                  <div className="relative w-24 h-24 rounded-xl bg-stone-100 overflow-hidden flex items-center justify-center flex-shrink-0 border border-stone-200">
                    {(qrPreview || shop.payment_qr_url)
                      ? <img src={qrPreview || shop.payment_qr_url} alt="Payment QR" className="w-full h-full object-contain" />
                      : <span className="text-2xl">📱</span>}
                    {qrUploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600">
                      📁 Upload QR code
                      <input type="file" accept="image/*" className="hidden" disabled={qrUploading} onChange={handlePaymentQrChange} />
                    </label>
                    <p className="text-xs text-stone-400 mt-1.5">Screenshot of your TnG / DuitNow receive QR</p>
                    {qrError && <p className="text-xs text-red-500 mt-1">{qrError}</p>}
                  </div>
                </div>

                {/* Bank details display */}
                {(shop.bank_name || shop.account_name || shop.account_number) && (
                  <div className="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-100">
                    <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Bank / E-wallet (fallback for buyers)</div>
                    {shop.bank_name && <div className="flex justify-between text-sm py-1"><span className="text-stone-500">Bank</span><span className="font-medium">{shop.bank_name}</span></div>}
                    {shop.account_name && <div className="flex justify-between text-sm py-1"><span className="text-stone-500">Name</span><span className="font-medium">{shop.account_name}</span></div>}
                    {shop.account_number && <div className="flex justify-between text-sm py-1"><span className="text-stone-500">Acc No.</span><span className="font-mono font-bold">{shop.account_number}</span></div>}
                  </div>
                )}
              </div>

              {/* Shop Images */}
              <div className="bg-white rounded-2xl border border-stone-100 p-6">
                <h3 className="font-bold text-stone-900 mb-4" style={{ fontFamily: "Lora, serif" }}>Shop Images</h3>
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Shop Logo</label>
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16 rounded-xl bg-stone-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {(logoPreview || shop.logo_url) ? <img src={logoPreview || shop.logo_url} alt="Logo" className="w-full h-full object-cover" /> : <span className="text-2xl">🏪</span>}
                        {logoUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}
                      </div>
                      <div>
                        <label className="inline-flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600">
                          📁 Choose logo<input type="file" accept="image/*" className="hidden" disabled={logoUploading} onChange={handleShopLogoChange} />
                        </label>
                        {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">Shop Banner</label>
                    <div className="flex flex-col gap-2">
                      <div className="relative w-full h-24 rounded-xl bg-stone-100 overflow-hidden flex items-center justify-center">
                        {(bannerPreview || shop.banner_url) ? <img src={bannerPreview || shop.banner_url} alt="Banner" className="w-full h-full object-cover" /> : <span className="text-stone-400 text-sm">No banner set</span>}
                        {bannerUploading && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>}
                      </div>
                      <label className="inline-flex items-center gap-2 px-3 py-2 border border-stone-200 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors text-sm text-stone-600 self-start">
                        📁 Choose banner<input type="file" accept="image/*" className="hidden" disabled={bannerUploading} onChange={handleShopBannerChange} />
                      </label>
                      {bannerError && <p className="text-xs text-red-500 mt-1">{bannerError}</p>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-red-200 p-6">
                <h3 className="font-bold text-red-700 mb-1" style={{ fontFamily: "Lora, serif" }}>Delete Shop</h3>
                <p className="text-xs text-stone-500 mb-4">This removes the shop from the marketplace and stops new orders. Existing transaction records are retained for account history and administration.</p>
                <button onClick={() => void deleteShop()} disabled={deletingShop} className="px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{deletingShop ? "Deleting…" : "Delete My Shop"}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Buyer payment proof modal ─────────────────────────────────────────── */}
      {paymentProofOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setPaymentProofOrder(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Payment Proof</h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  {paymentProofOrder.buyer} — {paymentProofOrder.code}
                </p>
              </div>
              <button
                onClick={() => setPaymentProofOrder(null)}
                className="text-stone-400 hover:text-stone-700 text-2xl leading-none"
                aria-label="Close payment proof"
              >
                ×
              </button>
            </div>
            <div className="p-5 bg-stone-50">
              <div className="rounded-xl border border-stone-200 bg-white p-3 max-h-[65vh] overflow-auto">
                <img
                  src={paymentProofOrder.payment_proof_url}
                  alt={`Payment proof from ${paymentProofOrder.buyer}`}
                  className="block max-w-full max-h-[60vh] mx-auto object-contain rounded-lg"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-stone-100 flex flex-wrap gap-2 justify-end">
              <a
                href={paymentProofOrder.payment_proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Open Full Image
              </a>
              {!paymentProofOrder.payment_verified_by_seller && paymentProofOrder.payment_confirmed_by === "buyer" && (
                <button
                  onClick={() => {
                    void handleVerifyPayment(paymentProofOrder.id);
                    setPaymentProofOrder(null);
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
                >
                  ✓ Verify Payment Received
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reject order modal ────────────────────────────────────────────────── */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Reject Order</h3>
            <p className="text-sm text-stone-500 mb-3">Provide a reason for the buyer.</p>
            <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={3} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => { void updateOrderStatus(rejectModal, "rejected", rejectReason); setRejectModal(null); setRejectReason(""); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600">Reject Order</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Propose New Time Modal ────────────────────────────────────────────── */}
      {proposeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setProposeModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Propose New Time</h3>
            <p className="text-sm text-stone-500 mb-4">Send a counter-offer for the requested service slot.</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">New Date</label>
                <input type="date" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">New Time</label>
                <input type="time" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setProposeModal(null)} className="flex-1 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
              <button onClick={() => void handleProposeTime()} disabled={!proposedDate || !proposedTime} className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50">Send Offer</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deliver + collect payment confirm modal ───────────────────────────── */}
      {deliverConfirmModal && (() => {
        const order = orders.find((o) => o.id === deliverConfirmModal);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeliverConfirmModal(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Mark as Delivered</h3>
              {order?.payment_timing === "on_pickup" && order?.payment_status !== "paid" ? (
                <>
                  <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                    💵 This order is set to pay on pickup. Please confirm you collected payment before completing.
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer mb-5">
                    <input type="checkbox" checked={paymentCollected} onChange={(e) => setPaymentCollected(e.target.checked)} className="accent-[#1C3270] w-4 h-4" />
                    <span className="text-sm text-stone-700 font-medium">I collected payment (RM {order.total.toFixed(2)}) from the buyer</span>
                  </label>
                </>
              ) : (
                <p className="text-sm text-stone-500 mb-5">Confirm this order has been delivered to the buyer.</p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setDeliverConfirmModal(null)} className="flex-1 py-2 border border-stone-200 rounded-lg text-sm">Cancel</button>
                <button
                  onClick={() => void handleDeliverWithPayment(deliverConfirmModal)}
                  disabled={order?.payment_timing === "on_pickup" && order?.payment_status !== "paid" && !paymentCollected}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-40"
                >
                  Confirm Delivered
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Promotion modal ───────────────────────────────────────────────────── */}
      {promoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setPromoteModal(null); setPromoStep("tier"); }} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            {promoStep === "tier" && (
              <>
                <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Promote Listing</h3>
                <p className="text-sm text-stone-500 mb-4">Choose a duration. You will pay the platform fee directly, then submit a receipt for admin review.</p>
                <div className="space-y-2 mb-5">
                  {PROMOTION_TIERS.map((tier) => (
                    <label key={tier.days} className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer ${promotionDays === tier.days ? "border-[#1C3270] bg-[#1C3270]/5" : "border-stone-200"}`}>
                      <span className="text-sm font-medium text-stone-700">{tier.days} days</span>
                      <span className="text-sm font-bold text-[#1C3270]">RM {tier.amount.toFixed(2)}</span>
                      <input type="radio" checked={promotionDays === tier.days} onChange={() => setPromotionDays(tier.days)} className="accent-[#1C3270]" />
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setPromoteModal(null)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm">Cancel</button>
                  <button onClick={() => setPromoStep("qr")} className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A]">Continue →</button>
                </div>
              </>
            )}

            {promoStep === "qr" && (
              <>
                <h3 className="font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Pay Platform Fee</h3>
                <div className="bg-[#1C3270] rounded-xl px-4 py-3 text-white text-center mb-4">
                  <div className="text-2xl font-bold">RM {(PROMOTION_TIERS.find((t) => t.days === promotionDays)?.amount ?? 0).toFixed(2)}</div>
                  <div className="text-xs opacity-70 mt-0.5">Pay to AIU Market platform</div>
                </div>

                {platformInfo?.payment_qr_url ? (
                  <div className="text-center mb-4">
                    <p className="text-xs text-stone-500 mb-2">Scan with TnG or banking app</p>
                    <div className="inline-block border-4 border-[#1C3270]/20 rounded-xl p-1.5">
                      <img src={platformInfo.payment_qr_url} alt="Platform QR" className="w-40 h-40 object-contain rounded-lg mx-auto" />
                    </div>
                  </div>
                ) : !platformInfo ? (
                  <div className="bg-stone-50 rounded-xl p-4 text-center text-sm text-stone-400 mb-4">Loading payment details…</div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-4">
                    ⚠️ Platform payment QR not configured yet. Use the bank details below or contact admin.
                  </div>
                )}

                {(platformInfo?.bank_name || platformInfo?.account_name || platformInfo?.account_number) && (
                  <div className="bg-stone-50 rounded-xl border border-stone-100 p-3 space-y-1.5 mb-4">
                    <div className="text-xs font-semibold text-stone-400 uppercase">Bank Transfer</div>
                    {platformInfo.bank_name && <div className="flex justify-between text-sm"><span className="text-stone-500">Bank</span><span className="font-medium">{platformInfo.bank_name}</span></div>}
                    {platformInfo.account_name && <div className="flex justify-between text-sm"><span className="text-stone-500">Name</span><span className="font-medium">{platformInfo.account_name}</span></div>}
                    {platformInfo.account_number && <div className="flex justify-between text-sm"><span className="text-stone-500">Acc No.</span><span className="font-mono font-bold select-all">{platformInfo.account_number}</span></div>}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setPromoStep("tier")} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm">← Back</button>
                  <button onClick={() => setPromoStep("receipt")} className="flex-1 py-2.5 bg-[#44B444] text-white rounded-xl text-sm font-bold hover:bg-[#2E8A2E]">I&apos;ve Paid →</button>
                </div>
              </>
            )}

            {promoStep === "receipt" && (
              <>
                <h3 className="font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Upload Payment Receipt</h3>
                <p className="text-sm text-stone-500 mb-4">Take a screenshot of your TnG or banking app payment confirmation and upload it here. Admin will review and activate your promotion.</p>

                <div
                  className="border-2 border-dashed border-stone-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#1C3270] transition-colors mb-4"
                  onClick={() => promoReceiptRef.current?.click()}
                >
                  {promoReceiptPreview
                    ? <img src={promoReceiptPreview} alt="Receipt" className="max-h-40 mx-auto rounded-lg object-contain" />
                    : <div className="text-stone-400 text-sm">📸 Click to upload receipt screenshot</div>
                  }
                  <input
                    ref={promoReceiptRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPromoReceiptFile(file);
                      setPromoReceiptPreview(URL.createObjectURL(file));
                      e.target.value = "";
                    }}
                  />
                </div>

                {promoError && <div className="text-xs text-red-500 mb-3">{promoError}</div>}

                <div className="flex gap-3">
                  <button onClick={() => setPromoStep("qr")} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm">← Back</button>
                  <button
                    onClick={() => void handleSubmitPromotion()}
                    disabled={promoSubmitting || !promoReceiptFile}
                    className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A] disabled:opacity-60"
                  >
                    {promoSubmitting ? "Submitting…" : "Submit for Review"}
                  </button>
                </div>
              </>
            )}

            {promoStep === "submitted" && (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">⏳</div>
                <h3 className="font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Promotion Submitted!</h3>
                <p className="text-sm text-stone-500 mb-5">Your receipt is being reviewed by admin. Your listing will be promoted once approved (usually within 1–2 business days).</p>
                <button onClick={() => { setPromoteModal(null); setPromoStep("tier"); }} className="w-full py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A]">Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Product modal ─────────────────────────────────────────────────── */}
      {commissionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCommissionModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Pay Monthly Commission</h3>
            <p className="text-sm text-stone-500 mb-4">Pay the platform, then upload your receipt for admin review.</p>
            <div className="bg-[#1C3270] rounded-xl px-4 py-3 text-white text-center mb-4">
              <div className="text-2xl font-bold">RM {currentCommissionOwed.toFixed(2)}</div>
              <div className="text-xs opacity-70 mt-0.5">{monthCommissionSales.orderCount} completed paid orders</div>
            </div>

            {platformInfo?.payment_qr_url ? (
              <div className="text-center mb-4">
                <p className="text-xs text-stone-500 mb-2">Scan with TnG or banking app</p>
                <div className="inline-block border-4 border-[#1C3270]/20 rounded-xl p-1.5">
                  <img src={platformInfo.payment_qr_url} alt="Platform QR" className="w-40 h-40 object-contain rounded-lg mx-auto" />
                </div>
              </div>
            ) : !platformInfo ? (
              <div className="bg-stone-50 rounded-xl p-4 text-center text-sm text-stone-400 mb-4">Loading payment details...</div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800 mb-4">
                Platform payment QR is not configured yet. Use the bank details below or contact admin.
              </div>
            )}

            {(platformInfo?.bank_name || platformInfo?.account_name || platformInfo?.account_number) && (
              <div className="bg-stone-50 rounded-xl border border-stone-100 p-3 space-y-1.5 mb-4">
                <div className="text-xs font-semibold text-stone-400 uppercase">Bank Transfer</div>
                {platformInfo.bank_name && <div className="flex justify-between text-sm"><span className="text-stone-500">Bank</span><span className="font-medium">{platformInfo.bank_name}</span></div>}
                {platformInfo.account_name && <div className="flex justify-between text-sm"><span className="text-stone-500">Name</span><span className="font-medium">{platformInfo.account_name}</span></div>}
                {platformInfo.account_number && <div className="flex justify-between text-sm"><span className="text-stone-500">Acc No.</span><span className="font-mono font-bold select-all">{platformInfo.account_number}</span></div>}
              </div>
            )}

            <div
              className="border-2 border-dashed border-stone-300 rounded-xl p-4 text-center cursor-pointer hover:border-[#1C3270] transition-colors mb-4"
              onClick={() => commissionReceiptRef.current?.click()}
            >
              {commissionReceiptPreview
                ? <img src={commissionReceiptPreview} alt="Receipt" className="max-h-40 mx-auto rounded-lg object-contain" />
                : <div className="text-stone-400 text-sm">Click to upload receipt screenshot</div>
              }
              <input
                ref={commissionReceiptRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setCommissionReceiptFile(file);
                  setCommissionReceiptPreview(URL.createObjectURL(file));
                  e.target.value = "";
                }}
              />
            </div>
            {commissionError && <div className="text-xs text-red-500 mb-3">{commissionError}</div>}
            <div className="flex gap-3">
              <button onClick={() => setCommissionModalOpen(false)} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm">Cancel</button>
              <button
                onClick={() => void handleSubmitCommissionSettlement()}
                disabled={commissionSubmitting || !commissionReceiptFile}
                className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A] disabled:opacity-60"
              >
                {commissionSubmitting ? "Submitting..." : "Submit Receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeEditListing} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-stone-900 text-lg" style={{ fontFamily: "Lora, serif" }}>Edit {editingListing.type === "service" ? "Service" : "Product"}</h3>
                <p className="text-xs text-stone-400 mt-0.5">Changes are saved directly to this listing.</p>
              </div>
              <button onClick={closeEditListing} className="text-stone-400 hover:text-stone-600 text-xl">×</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Name *</label>
                <input value={editingListing.name} onChange={(e) => setEditingListing((v: any) => ({ ...v, name: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Price (RM) *</label>
                  <input type="number" value={editingListing.price} onChange={(e) => setEditingListing((v: any) => ({ ...v, price: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
                </div>
                {editingListing.type === "product" && (
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Stock Quantity</label>
                    <input type="number" value={editingListing.stock} onChange={(e) => setEditingListing((v: any) => ({ ...v, stock: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Category</label>
                <select value={editingListing.category} onChange={(e) => setEditingListing((v: any) => ({ ...v, category: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50">
                  <option value="">Select...</option>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Description</label>
                <textarea value={editingListing.description} onChange={(e) => setEditingListing((v: any) => ({ ...v, description: e.target.value }))} rows={5} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 resize-none" />
              </div>
              {editingListing.type === "service" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium text-stone-600 mb-1">Price Type</label><select value={editingListing.price_type || "Fixed price"} onChange={(e) => setEditingListing((v: any) => ({ ...v, price_type: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option>Fixed price</option><option>Starting from</option><option>Per hour</option><option>Per session</option></select></div>
                    <div><label className="block text-xs font-medium text-stone-600 mb-1">Availability</label><select value={editingListing.availability || "available"} onChange={(e) => setEditingListing((v: any) => ({ ...v, availability: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option value="available">Available now</option><option value="slots_open">Slots open this week</option><option value="fully_booked">Fully booked</option></select></div>
                  </div>
                  <div><label className="block text-xs font-medium text-stone-600 mb-1">What's Included</label><textarea value={editingListing.what_included || ""} onChange={(e) => setEditingListing((v: any) => ({ ...v, what_included: e.target.value }))} rows={4} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 resize-none" /></div>
                  <div><label className="block text-xs font-medium text-stone-600 mb-1">Turnaround</label><input value={editingListing.turnaround || ""} onChange={(e) => setEditingListing((v: any) => ({ ...v, turnaround: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" /></div>
                </>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={closeEditListing} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm">Cancel</button>
              <button onClick={() => void saveListingEdit()} disabled={editSaving || !editingListing.name || !editingListing.price} className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A] disabled:opacity-60">
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addServiceOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeAddService} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div><h3 className="font-bold text-stone-900 text-lg" style={{ fontFamily: "Lora, serif" }}>Add New Service</h3><p className="text-xs text-stone-400">Give buyers enough detail to understand exactly what they receive.</p></div>
              <button onClick={closeAddService} className="text-stone-400 hover:text-stone-600 text-xl">×</button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium text-stone-600 mb-1">Service Name *</label><input value={serviceForm.name} onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Canva Poster Design" className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-stone-600 mb-1">Price (RM) *</label><input type="number" min="0" step="0.01" value={serviceForm.price} onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" /></div>
                <div><label className="block text-xs font-medium text-stone-600 mb-1">Price Type</label><select value={serviceForm.priceType} onChange={(e) => setServiceForm((f) => ({ ...f, priceType: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option>Fixed price</option><option>Starting from</option><option>Per hour</option><option>Per session</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-600 mb-1">Turnaround *</label>
                    <div className="flex gap-2">
                      <input type="number" min="1" value={serviceForm.turnaroundNum} onChange={(e) => setServiceForm((f) => ({ ...f, turnaroundNum: e.target.value }))} className="w-1/2 px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
                      <select value={serviceForm.turnaroundUnit} onChange={(e) => setServiceForm((f) => ({ ...f, turnaroundUnit: e.target.value }))} className="w-1/2 px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50">
                        <option>Days</option><option>Weeks</option><option>Months</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Availability (Working Days)</label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                      <label key={day} className="flex items-center gap-1.5 text-sm">
                        <input 
                          type="checkbox" 
                          checked={serviceForm.availDays.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) setServiceForm(f => ({ ...f, availDays: [...f.availDays, day] }));
                            else setServiceForm(f => ({ ...f, availDays: f.availDays.filter(d => d !== day) }));
                          }}
                          className="rounded border-stone-300 text-[#1C3270] focus:ring-[#1C3270]"
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Working Hours</label>
                  <div className="flex items-center gap-2">
                    <input type="time" value={serviceForm.availStart} onChange={(e) => setServiceForm(f => ({ ...f, availStart: e.target.value }))} className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
                    <span className="text-stone-400">to</span>
                    <input type="time" value={serviceForm.availEnd} onChange={(e) => setServiceForm(f => ({ ...f, availEnd: e.target.value }))} className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50" />
                  </div>
                </div>
              <div><label className="block text-xs font-medium text-stone-600 mb-1">Category *</label><select value={serviceForm.category} onChange={(e) => setServiceForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50"><option value="">Select...</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-stone-600 mb-1">Description *</label><textarea value={serviceForm.description} onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Explain the service and who it is for." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 resize-none" /></div>
              <div><label className="block text-xs font-medium text-stone-600 mb-1">What's Included * </label><textarea value={serviceForm.whatIncluded} onChange={(e) => setServiceForm((f) => ({ ...f, whatIncluded: e.target.value }))} rows={4} placeholder="List deliverables, revisions, files, sessions, materials, etc." className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-stone-50 resize-none" /></div>

              <div><label className="block text-xs font-medium text-stone-600 mb-1">Service Image (optional)</label><label className="block border-2 border-dashed border-stone-200 rounded-lg p-4 text-center cursor-pointer hover:border-[#1C3270]"><input type="file" accept="image/*" className="hidden" onChange={(e) => { const file=e.target.files?.[0]; if(!file)return; const err=validateImageFile(file); if(err){setServiceImageError(err);return;} setServiceImageError(""); setServiceImageFile(file); setServiceImagePreview(URL.createObjectURL(file)); e.target.value=""; }} />{serviceImagePreview ? <img src={serviceImagePreview} alt="Service preview" className="h-28 w-full object-cover rounded-lg" /> : <span className="text-xs text-stone-400">📸 Upload service image</span>}</label>{serviceImageError && <p className="text-xs text-red-500 mt-1">{serviceImageError}</p>}</div>
            </div>
            <div className="flex gap-3 mt-5"><button onClick={closeAddService} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm">Cancel</button><button onClick={() => void handleAddService()} disabled={serviceImageUploading} className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold disabled:opacity-50">{serviceImageUploading ? "Saving…" : "Add Service"}</button></div>
          </div>
        </div>
      )}

      {addProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeAddProduct} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-900 text-lg" style={{ fontFamily: "Lora, serif" }}>Add New Product</h3>
              <button onClick={closeAddProduct} className="text-stone-400 hover:text-stone-600 text-xl">x</button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium text-stone-600 mb-1">Product Name *</label><input value={productForm.name} onChange={(e) => setProductForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-stone-600 mb-1">Price (RM) *</label><input type="number" value={productForm.price} onChange={(e) => setProductForm((f) => ({ ...f, price: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" /></div>
                <div><label className="block text-xs font-medium text-stone-600 mb-1">Stock Quantity *</label><input type="number" value={productForm.stock} onChange={(e) => setProductForm((f) => ({ ...f, stock: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" /></div>
              </div>
              <div><label className="block text-xs font-medium text-stone-600 mb-1">Category *</label><select value={productForm.category} onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50"><option value="">Select...</option>{categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-stone-600 mb-1">Description *</label><textarea value={productForm.description} onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none" /></div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Product Photos</label>
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-stone-300 rounded-lg cursor-pointer hover:border-[#1C3270] transition-colors text-xs text-stone-500">
                  <span>📸</span><span>Add photos (max 5 MB each)</span>
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleProductImageChange} />
                </label>
                {productImagePreviews.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {productImagePreviews.map((src, i) => (
                      <div key={i} className="relative w-16 h-16">
                        <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover rounded-lg" />
                        {productImagesUploading
                          ? <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center"><svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg></div>
                          : <button type="button" onClick={() => removeProductImage(i)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600">×</button>
                        }
                      </div>
                    ))}
                  </div>
                )}
                {productImagesError && <p className="text-xs text-red-500 mt-1">{productImagesError}</p>}
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={closeAddProduct} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm">Cancel</button>
              <button onClick={handleAddProduct} disabled={productImagesUploading} className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A] disabled:opacity-60">Add Listing</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}