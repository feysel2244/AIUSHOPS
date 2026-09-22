import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useCategories } from "../hooks/useCategories";
import { CAMPUS_LOCATIONS } from "../data/mockData";
import {
  createQuickListing,
  fetchMyQuickListings,
  countActiveListings,
  deleteQuickListing,
  markListingAsSold,
  type QuickListing,
  type QuickListingCondition,
  CONDITION_LABELS,
  MAX_QUICK_LISTINGS,
} from "../lib/quickListings";
import { validateImageFile, uploadImage } from "../lib/uploadImage";
import { cloudinaryOptimize } from "../lib/cloudinary";
import { supabase } from "../lib/supabase";
import QuickListingCard from "../components/cards/QuickListingCard";

const CONDITIONS: { value: QuickListingCondition; label: string; desc: string }[] = [
  { value: "new",      label: "New",       desc: "Never used, still sealed" },
  { value: "like_new", label: "Like New",  desc: "Used once or twice, no defects" },
  { value: "good",     label: "Good",      desc: "Normal wear, fully functional" },
  { value: "fair",     label: "Fair",      desc: "Visible wear but works fine" },
];

export default function QuickSellPage() {
  const { user, openAuthModal } = useApp();
  const { categories } = useCategories();
  const navigate = useNavigate();

  // ── form state ──────────────────────────────────────────────────────────────
  const [title,           setTitle]           = useState("");
  const [description,     setDescription]     = useState("");
  const [price,           setPrice]           = useState("");
  const [condition,       setCondition]       = useState<QuickListingCondition>("good");
  const [category,        setCategory]        = useState("");
  const [pickupLocation,  setPickupLocation]  = useState("");
  const [imageFiles,      setImageFiles]      = useState<File[]>([]);
  const [imagePreviews,   setImagePreviews]   = useState<string[]>([]);
  const [imageError,      setImageError]      = useState("");
  const [submitting,      setSubmitting]      = useState(false);
  const [submitError,     setSubmitError]     = useState("");
  const [submitted,       setSubmitted]       = useState(false);

  // ── my listings state ───────────────────────────────────────────────────────
  const [myListings,  setMyListings]  = useState<QuickListing[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loadingMine, setLoadingMine] = useState(true);

  // ── payment setup state ──────────────────────────────────────────────────────
  const [payQrUrl,      setPayQrUrl]      = useState<string | null>(null);
  const [payBankName,   setPayBankName]   = useState("");
  const [payAccName,    setPayAccName]    = useState("");
  const [payAccNumber,  setPayAccNumber]  = useState("");
  const [payQrFile,     setPayQrFile]     = useState<File | null>(null);
  const [payQrPreview,  setPayQrPreview]  = useState("");
  const [payQrError,    setPayQrError]    = useState("");
  const [savingPay,     setSavingPay]     = useState(false);
  const [paySaved,      setPaySaved]      = useState(false);
  const payQrRef = useRef<HTMLInputElement>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  // Load the user's own listings + payment info on mount
  useEffect(() => {
    if (!user) return;
    void (async () => {
      setLoadingMine(true);
      const [listings, count, profileData] = await Promise.all([
        fetchMyQuickListings(user.id),
        countActiveListings(user.id),
        supabase.from("profiles").select("payment_qr_url,bank_name,account_name,account_number").eq("id", user.id).maybeSingle(),
      ]);
      setMyListings(listings);
      setActiveCount(count);
      const p = profileData.data;
      if (p) {
        setPayQrUrl(p.payment_qr_url ?? null);
        setPayBankName(p.bank_name     ?? "");
        setPayAccName(p.account_name   ?? "");
        setPayAccNumber(p.account_number ?? "");
      }
      setLoadingMine(false);
    })();
  }, [user, submitted]);

  async function savePaymentInfo() {
    if (!user) return;
    setSavingPay(true);
    setPayQrError("");
    setPaySaved(false);
    try {
      let qrUrl = payQrUrl;
      if (payQrFile) {
        qrUrl = await uploadImage(
          "payment-qr",
          `${user.id}/payment-qr-${Date.now()}`,
          payQrFile
        );
        setPayQrUrl(qrUrl);
        setPayQrFile(null);
      }
      const { error } = await supabase
        .from("profiles")
        .update({
          payment_qr_url: qrUrl ?? null,
          bank_name:      payBankName  || null,
          account_name:   payAccName   || null,
          account_number: payAccNumber || null,
        })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      setPaySaved(true);
      setTimeout(() => setPaySaved(false), 3000);
    } catch (err) {
      setPayQrError(err instanceof Error ? err.message : "Failed to save payment info.");
    }
    setSavingPay(false);
  }

  // ── image picker ────────────────────────────────────────────────────────────
  function handleImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setImageError("");
    
    let currentCount = imageFiles.length;
    const valid: File[] = [];
    const previews: string[] = [];
    
    for (const f of files) {
      if (currentCount >= 3) break;
      const err = validateImageFile(f);
      if (err) { setImageError(err); continue; }
      valid.push(f);
      previews.push(URL.createObjectURL(f));
      currentCount++;
    }
    
    setImageFiles(prev => [...prev, ...valid].slice(0, 3));
    setImagePreviews(prev => [...prev, ...previews].slice(0, 3));
    e.target.value = "";
  }

  function removeImage(idx: number) {
    setImageFiles(prev => prev.filter((_, i) => i !== idx));
    setImagePreviews(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleMarkSold(id: string) {
    try {
      await markListingAsSold(id);
      setSubmitted(p => !p); // trigger reload
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not mark as sold");
    }
  }

  // ── submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) { openAuthModal("login"); return; }
    if (activeCount >= MAX_QUICK_LISTINGS) return;

    const p = parseFloat(price);
    if (!title.trim() || !category || !pickupLocation || isNaN(p) || p <= 0) {
      setSubmitError("Please fill in all required fields.");
      return;
    }
    if (imageFiles.length === 0) {
      setSubmitError("Please add at least one photo.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      await createQuickListing(user.id, {
        title,
        description,
        price: p,
        condition,
        category,
        pickupLocation,
        imageFiles,
      });
      // reset form
      setTitle(""); setDescription(""); setPrice("");
      setCondition("good"); setCategory(""); setPickupLocation("");
      setImageFiles([]); setImagePreviews([]);
      setSubmitted(prev => !prev); // trigger reload
    } catch (err: unknown) {
      const msg =
        err instanceof Error                                ? err.message :
        (err as any)?.message ? String((err as any).message) :
        JSON.stringify(err);
      const isSetupError =
        msg.includes("relation") ||
        msg.includes("does not exist") ||
        msg.includes("relationship") ||
        msg.includes("schema cache");
      setSubmitError(isSetupError
        ? `Database not ready: ${msg}. Try refreshing the Supabase schema cache (Dashboard → API → Reload).`
        : msg
      );
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    await deleteQuickListing(id);
    setSubmitted(prev => !prev);
  }

  // ── auth gate ───────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🏷️</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>
          Sign in to Quick Sell
        </h2>
        <p className="text-stone-500 mb-4">
          List items you no longer need — textbooks, gadgets, clothes — and sell them to fellow students.
        </p>
        <button
          onClick={() => openAuthModal("login")}
          className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium"
        >
          Log in
        </button>
      </div>
    );
  }

  const atLimit = activeCount >= MAX_QUICK_LISTINGS;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-stone-900 dark:text-[#E2EAF6]" style={{ fontFamily: "Lora, serif" }}>
          Quick Sell
        </h1>
        <p className="text-stone-500 dark:text-[#6888A8] mt-1 text-sm">
          Sell items you no longer need — no shop required. Up to {MAX_QUICK_LISTINGS} active listings at a time.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 rounded-full bg-stone-200 dark:bg-[#1C3058] flex-1 max-w-xs overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(activeCount / MAX_QUICK_LISTINGS) * 100}%`,
                background: atLimit ? "#B3261E" : "#44B444",
              }}
            />
          </div>
          <span className={`text-xs font-semibold ${atLimit ? "text-red-600" : "text-stone-500"}`}>
            {activeCount} / {MAX_QUICK_LISTINGS} active
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">

        {/* ── Post form ───────────────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-bold text-stone-800 dark:text-[#E2EAF6] mb-4">
            {atLimit ? "Listing limit reached" : "Post a New Listing"}
          </h2>

          {atLimit ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-5 text-sm text-red-700 dark:text-red-300">
              You have {MAX_QUICK_LISTINGS} active listings. Mark one as <strong>Sold</strong> or delete it before posting a new one.
            </div>
          ) : (
            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Calculus textbook 4th edition"
                  maxLength={80}
                  required
                  className="w-full h-10 px-3 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Any extra details about the item..."
                  rows={3}
                  maxLength={400}
                  className="w-full px-3 py-2 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] resize-none bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]"
                />
              </div>

              {/* Price + Category row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-1">
                    Price (RM) <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    type="number"
                    min="0.50"
                    step="0.50"
                    placeholder="0.00"
                    required
                    className="w-full h-10 px-3 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    required
                    className="w-full h-10 px-3 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]"
                  >
                    <option value="">Select...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-2">
                  Condition <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CONDITIONS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCondition(c.value)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                        condition === c.value
                          ? "border-[#1C3270] bg-[#1C3270]/5 dark:bg-[#1C3270]/20"
                          : "border-stone-200 dark:border-[#1C3058] hover:border-stone-300"
                      }`}
                    >
                      <div className="font-semibold text-stone-800 dark:text-[#E2EAF6]">{c.label}</div>
                      <div className="text-stone-400 dark:text-[#4E6A88] mt-0.5">{c.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Pickup location */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-1">
                  Pickup Location <span className="text-red-500">*</span>
                </label>
                <select
                  value={pickupLocation}
                  onChange={e => setPickupLocation(e.target.value)}
                  required
                  className="w-full h-10 px-3 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]"
                >
                  <option value="">Select location...</option>
                  {CAMPUS_LOCATIONS.map(l => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Photos */}
              <div>
                <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-2">
                  Photos (up to 3) <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-0.5 right-0.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {imageFiles.length < 3 && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-stone-300 dark:border-[#1C3058] flex flex-col items-center justify-center text-stone-400 hover:border-[#1C3270] hover:text-[#1C3270] transition-colors text-xs gap-1"
                    >
                      <span className="text-2xl">+</span>
                      <span>Photo</span>
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImages}
                />
                {imageError && <p className="text-xs text-red-500 mt-1">{imageError}</p>}
              </div>

              {submitError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: submitting ? "#888" : "#44B444" }}
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading photos &amp; posting…
                  </>
                ) : "Post Listing"}
              </button>
            </form>
          )}
        </section>

        {/* ── Right Column: Payment & My Listings ─────────────────────────── */}
        <div className="space-y-10">
          
          {/* ── Payment Setup ────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold text-stone-800 dark:text-[#E2EAF6] mb-4">How you get paid</h2>
            <div className="bg-white dark:bg-[#112038] rounded-xl border border-stone-200 dark:border-[#1C3058] p-5 shadow-sm">
              <p className="text-sm text-stone-500 dark:text-[#6888A8] mb-4 leading-relaxed">
                Add your payment QR (TnG eWallet, DuitNow) or bank account. Buyers will use this to pay you at checkout.
              </p>
              
              <div className="space-y-4">
                {/* QR Code Upload */}
                <div>
                  <label className="block text-sm font-semibold text-stone-700 dark:text-[#A8C0D8] mb-2">
                    Payment QR Code (Optional)
                  </label>
                  <div className="flex items-start gap-4">
                    <div 
                      onClick={() => payQrRef.current?.click()}
                      className="w-24 h-24 rounded-lg border-2 border-dashed border-stone-300 dark:border-[#1C3058] flex items-center justify-center overflow-hidden bg-stone-50 dark:bg-[#0E1A2E] relative cursor-pointer hover:border-[#1C3270] transition-colors flex-shrink-0"
                    >
                      {payQrPreview ? (
                        <img src={payQrPreview} alt="QR Preview" className="w-full h-full object-cover" />
                      ) : payQrUrl ? (
                        <img src={cloudinaryOptimize(payQrUrl, 200)} alt="Saved QR" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-stone-400 text-[10px] text-center px-2">Tap to upload QR</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <input 
                        ref={payQrRef} 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            const err = validateImageFile(f);
                            if (err) setPayQrError(err);
                            else { setPayQrFile(f); setPayQrPreview(URL.createObjectURL(f)); setPayQrError(""); }
                          }
                          e.target.value = "";
                        }} 
                      />
                      {(payQrUrl || payQrPreview) && (
                        <button
                          type="button"
                          onClick={() => { setPayQrUrl(null); setPayQrFile(null); setPayQrPreview(""); }}
                          className="text-xs text-red-500 hover:underline mt-1"
                        >
                          Remove QR
                        </button>
                      )}
                      {payQrError && <p className="text-xs text-red-500 mt-1">{payQrError}</p>}
                    </div>
                  </div>
                </div>

                {/* Bank details */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-stone-600 dark:text-[#A8C0D8] mb-1">Bank Name</label>
                    <input 
                      value={payBankName} 
                      onChange={e => setPayBankName(e.target.value)} 
                      placeholder="e.g. Maybank" 
                      className="w-full h-9 px-3 text-sm border border-stone-200 dark:border-[#1C3058] rounded-lg bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]" 
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-stone-600 dark:text-[#A8C0D8] mb-1">Account Name</label>
                    <input 
                      value={payAccName} 
                      onChange={e => setPayAccName(e.target.value)} 
                      placeholder="Your Name" 
                      className="w-full h-9 px-3 text-sm border border-stone-200 dark:border-[#1C3058] rounded-lg bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]" 
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-stone-600 dark:text-[#A8C0D8] mb-1">Account Number</label>
                    <input 
                      value={payAccNumber} 
                      onChange={e => setPayAccNumber(e.target.value)} 
                      placeholder="e.g. 1140 1234 5678" 
                      className="w-full h-9 px-3 text-sm border border-stone-200 dark:border-[#1C3058] rounded-lg bg-white dark:bg-[#0E1A2E] dark:text-[#E2EAF6]" 
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => void savePaymentInfo()}
                    disabled={savingPay}
                    className="w-full py-2 bg-stone-800 text-white dark:bg-[#1C3270] text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {savingPay ? "Saving..." : paySaved ? "✓ Saved" : "Save Payment Info"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* ── My listings ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="text-lg font-bold text-stone-800 dark:text-[#E2EAF6] mb-4">My Listings</h2>
          {loadingMine ? (
            <div className="text-stone-400 text-sm">Loading...</div>
          ) : myListings.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#112038] rounded-xl border border-dashed border-stone-200 dark:border-[#1C3058]">
              <div className="text-4xl mb-2">🏷️</div>
              <p className="text-stone-500 text-sm">No listings yet. Post your first item!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myListings.map(l => (
                <div key={l.id} className="flex gap-3 bg-white dark:bg-[#112038] rounded-xl border border-stone-100 dark:border-[#1C3058] p-3 shadow-sm">
                  <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-stone-100">
                    <img
                      src={cloudinaryOptimize(l.images[0], 128)}
                      alt={l.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-stone-900 dark:text-[#E2EAF6] line-clamp-1">{l.title}</div>
                    <div className="text-xs text-stone-500 mt-0.5">RM {l.price.toFixed(2)} · {l.conditionLabel}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        l.status === "active"  ? "bg-green-50 text-green-700"  :
                        l.status === "sold"    ? "bg-stone-100 text-stone-500"  :
                        "bg-amber-50 text-amber-700"
                      }`}>
                        {l.status === "active" ? "Active" : l.status === "sold" ? "Sold" : "Expired"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {l.status === "active" && (
                      <button
                        onClick={(e) => { e.preventDefault(); void handleMarkSold(l.id); }}
                        className="text-xs px-2 py-1 rounded-lg border border-[#44B444] text-[#44B444] hover:bg-[#44B444] hover:text-white transition-all"
                      >
                        Sold
                      </button>
                    )}
                    <button
                      onClick={() => void handleDelete(l.id)}
                      className="text-xs px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </div>
      </div>
    </div>
  );
}
