import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { CAMPUS_LOCATIONS } from "../data/mockData";
import { useCategories } from "../hooks/useCategories";
import { supabase } from "../lib/supabase";
import { slugify } from "../lib/marketData";
import { uploadImage, validateImageFile } from "../lib/uploadImage";
import { notifyAdminsSellerApplication } from "../lib/payments";


const STEPS = ["Eligibility", "Shop Setup", "Payment Setup", "Submit"];

export default function BecomeSellerPage() {
  const { user, openAuthModal } = useApp();
  const { categories } = useCategories();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [shopForm, setShopForm] = useState({ name: "", category: "", bio: "", pickup: "", shopType: "both" });
  const [payForm, setPayForm] = useState({ bank: "", accountName: "", accountNo: "", agreed: false });
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [logoError, setLogoError] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerError, setBannerError] = useState("");
  // Payment QR
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreview, setQrPreview] = useState("");
  const [qrError, setQrError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🏪</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Sign in to open a shop</h2>
        <button onClick={() => openAuthModal("signup")} className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium text-sm">Create Account</button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-10">
          <div className="text-5xl mb-4">🎓</div>
          <h2 className="text-2xl font-bold text-stone-900 mb-3" style={{ fontFamily: "Lora, serif" }}>Shop Submitted for Review!</h2>
          <p className="text-stone-500 mb-2 text-sm leading-relaxed">
            Your shop application has been sent to the AIU Market admin team for review. This usually takes 1–2 business days.
          </p>
          <p className="text-stone-400 text-xs mb-6">You'll receive an email notification once your shop is approved or if any information is needed.</p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <div className="text-sm font-semibold text-blue-900 mb-1">🕐 What happens next?</div>
            <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
              <li>Admin reviews your shop details</li>
              <li>You receive an approval or feedback email</li>
              <li>Once approved, your shop goes live instantly</li>
              <li>Start adding products and services!</li>
            </ul>
          </div>
          <button onClick={() => navigate("/")} className="w-full py-2.5 bg-[#1C3270] text-white rounded-xl font-semibold text-sm hover:bg-[#0F1F4A] transition-colors">
            Return to Marketplace
          </button>
        </div>
      </div>
    );
  }

  function canProceed() {
    if (step === 1) return shopForm.name && shopForm.category && shopForm.bio && shopForm.pickup && shopForm.shopType;
    if (step === 2) return payForm.agreed;
    return true;
  }

  async function handleNext() {
    if (step < 3) setStep(step + 1);
    else {
      setSubmitting(true);
      setSubmitError("");

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: user!.id,
        name: user!.name,
        email: user!.email,
        department: user!.department,
        year: user!.year,
        whatsapp: user!.whatsapp,
        has_shop: false,
      });

      if (profileError) {
        setSubmitting(false);
        setSubmitError(`Your profile could not be saved before creating a shop: ${profileError.message}`);
        return;
      }

      const { data: existingShop, error: existingShopError } = await supabase
        .from("shops")
        .select("id,status")
        .eq("owner_id", user!.id)
        .in("status", ["pending", "approved"])
        .maybeSingle();

      if (existingShop) {
        setSubmitting(false);
        if (existingShop.status === "approved") navigate("/seller/dashboard");
        else setSubmitted(true);
        return;
      }

      if (existingShopError) {
        setSubmitting(false);
        setSubmitError(existingShopError.message);
        return;
      }

      const shopApplication = {
        owner_id: user!.id,
        slug: `${slugify(shopForm.name)}-${user!.id.slice(0, 8)}`,
        name: shopForm.name,
        category: shopForm.category,
        shop_type: shopForm.shopType,
        bio: shopForm.bio,
        pickup_location: shopForm.pickup,
        status: "pending",
        is_open: false,
        is_paused: false,
      };
      const payoutDetails = {
        bank_name: payForm.bank,
        account_name: payForm.accountName,
        account_number: payForm.accountNo,
      };

      // Insert shop and get back the ID so we can upload images to the right path
      let shopId: string | null = null;
      let { data: insertedShop, error } = await supabase
        .from("shops")
        .insert({ ...shopApplication, ...payoutDetails })
        .select("id")
        .single();

      if (!error && insertedShop) shopId = insertedShop.id;

      if (error && isMissingOptionalPayoutColumn(error.message)) {
        const { data: fallback, error: fallbackError } = await supabase
          .from("shops")
          .insert(shopApplication)
          .select("id")
          .single();
        if (!fallbackError && fallback) { shopId = fallback.id; error = null; }
        else if (fallbackError) error = fallbackError;
      }

      setSubmitting(false);
      if (error) {
        setSubmitError(error.message);
        return;
      }

      // Upload logo, banner, payment QR after shop creation (non-blocking)
      if (shopId && (logoFile || bannerFile || qrFile)) {
        const urlUpdates: Record<string, string> = {};
        if (logoFile) {
          try {
            const ext = logoFile.name.split(".").pop() || "jpg";
            urlUpdates.logo_url = await uploadImage("shop-logos", `${shopId}/logo-${Date.now()}.${ext}`, logoFile);
          } catch (imgErr) {
            setLogoError(imgErr instanceof Error ? imgErr.message : "Logo upload failed.");
          }
        }
        if (bannerFile) {
          try {
            const ext = bannerFile.name.split(".").pop() || "jpg";
            urlUpdates.banner_url = await uploadImage("shop-banners", `${shopId}/banner-${Date.now()}.${ext}`, bannerFile);
          } catch (imgErr) {
            setBannerError(imgErr instanceof Error ? imgErr.message : "Banner upload failed.");
          }
        }
        if (qrFile) {
          try {
            const ext = qrFile.name.split(".").pop() || "jpg";
            urlUpdates.payment_qr_url = await uploadImage("payment-qr", `${shopId}/qr-${Date.now()}.${ext}`, qrFile);
          } catch (imgErr) {
            setQrError(imgErr instanceof Error ? imgErr.message : "QR upload failed.");
          }
        }
        if (Object.keys(urlUpdates).length) {
          const { error: imageSaveError } = await supabase.from("shops").update(urlUpdates).eq("id", shopId);
          if (imageSaveError) {
            setSubmitError(`Your shop was submitted, but image URLs could not be saved: ${imageSaveError.message}`);
          }
        }
      }

      await notifyAdminsSellerApplication(shopForm.name.trim(), user!.name || user!.email);
      setSubmitted(true);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Open Your Shop</h1>
        <p className="text-stone-500 text-sm">Set up your student shop in a few quick steps</p>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i <= step ? "bg-[#1C3270] text-white" : "bg-stone-200 text-stone-500"}`}>
              {i < step ? "✓" : i + 1}
            </div>
            <div className="hidden sm:block">
              <div className={`text-xs font-medium ${i === step ? "text-[#1C3270]" : "text-stone-400"}`}>{s}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? "bg-[#1C3270]" : "bg-stone-200"}`} />}
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
        {step === 0 && (
          <div>
            <h2 className="font-bold text-stone-900 text-lg mb-1" style={{ fontFamily: "Lora, serif" }}>Eligibility Check</h2>
            <p className="text-stone-500 text-sm mb-5">Confirming your student account details.</p>
            <div className="space-y-3">
              {[
                ["Full Name", user.name],
                ["AIU Email", user.email],
                ["Department", user.department],
                ["Year of Study", user.year],
                ["WhatsApp", `+${user.whatsapp}`],
              ].map(([label, val]) => (
                <div key={label} className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100">
                  <span className="text-sm text-stone-500">{label}</span>
                  <span className="text-sm font-medium text-stone-900">{val || "—"}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              ✅ Your account is eligible to open a shop. No student ID verification required for this version.
            </div>
            {submitError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {submitError}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="font-bold text-stone-900 text-lg mb-1" style={{ fontFamily: "Lora, serif" }}>Shop Setup</h2>
            <p className="text-stone-500 text-sm mb-5">Tell us about your shop.</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Shop Name *</label>
                <input value={shopForm.name} onChange={(e) => setShopForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g., Nadia's Kitchen" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Category *</label>
                <select value={shopForm.category} onChange={(e) => setShopForm((f) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50">
                  <option value="">Select a category...</option>
                  {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">What will you offer? *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ["product", "Products", "Physical items"],
                    ["service", "Services", "Bookings / work"],
                    ["both", "Both", "Products + services"],
                  ].map(([value, label, desc]) => (
                    <button key={value} type="button" onClick={() => setShopForm((f) => ({ ...f, shopType: value }))} className={`text-left p-3 rounded-xl border transition-colors ${shopForm.shopType === value ? "border-[#1C3270] bg-[#1C3270]/5 ring-1 ring-[#1C3270]" : "border-stone-200 hover:border-stone-300"}`}>
                      <div className="font-semibold text-sm text-stone-900">{label}</div>
                      <div className="text-[11px] text-stone-400 mt-0.5">{desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Pickup Location *</label>
                <select value={shopForm.pickup} onChange={(e) => setShopForm((f) => ({ ...f, pickup: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50">
                  <option value="">Select location...</option>
                  {CAMPUS_LOCATIONS.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Short Bio *</label>
                <textarea value={shopForm.bio} onChange={(e) => setShopForm((f) => ({ ...f, bio: e.target.value }))} placeholder="Describe what you sell, your specialty, and why students should buy from you..." rows={3} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Shop Logo</label>
                <div
                  className="border-2 border-dashed border-stone-200 rounded-lg p-4 text-center text-sm text-stone-400 cursor-pointer hover:border-stone-300 transition-colors"
                  onClick={() => logoInputRef.current?.click()}
                >
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo preview" className="h-20 mx-auto rounded-lg object-contain" />
                    : <span>📸 Upload logo (optional)</span>
                  }
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const err = validateImageFile(file);
                    if (err) { setLogoError(err); return; }
                    setLogoError("");
                    setLogoFile(file);
                    setLogoPreview(URL.createObjectURL(file));
                    e.target.value = "";
                  }}
                />
                {logoError && <p className="text-xs text-red-500 mt-1">{logoError}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Banner Image</label>
                <div
                  className="border-2 border-dashed border-stone-200 rounded-lg p-4 text-center text-sm text-stone-400 cursor-pointer hover:border-stone-300 transition-colors"
                  onClick={() => bannerInputRef.current?.click()}
                >
                  {bannerPreview
                    ? <img src={bannerPreview} alt="Banner preview" className="h-20 w-full mx-auto rounded-lg object-cover" />
                    : <span>🖼️ Upload banner (optional)</span>
                  }
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const err = validateImageFile(file);
                    if (err) { setBannerError(err); return; }
                    setBannerError("");
                    setBannerFile(file);
                    setBannerPreview(URL.createObjectURL(file));
                    e.target.value = "";
                  }}
                />
                {bannerError && <p className="text-xs text-red-500 mt-1">{bannerError}</p>}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="font-bold text-stone-900 text-lg mb-1" style={{ fontFamily: "Lora, serif" }}>Payment Setup</h2>
            <p className="text-stone-500 text-sm mb-1">How will buyers pay you?</p>
            <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              💡 This is a <strong>peer-to-peer</strong> marketplace. Buyers pay you <em>directly</em> via TnG / DuitNow QR or bank transfer — not through the platform. Upload your personal &quot;Receive Money&quot; QR code here so buyers can scan it at checkout.
            </div>
            <div className="space-y-4">
              {/* QR upload */}
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Payment QR Code (recommended)</label>
                <div
                  className="border-2 border-dashed border-stone-200 rounded-lg p-4 text-center text-sm text-stone-400 cursor-pointer hover:border-stone-300 transition-colors"
                  onClick={() => qrInputRef.current?.click()}
                >
                  {qrPreview
                    ? <img src={qrPreview} alt="QR preview" className="h-32 mx-auto rounded-lg object-contain" />
                    : <span>📱 Upload your TnG / DuitNow receive QR (optional)</span>
                  }
                </div>
                <input
                  ref={qrInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const err = validateImageFile(file);
                    if (err) { setQrError(err); return; }
                    setQrError("");
                    setQrFile(file);
                    setQrPreview(URL.createObjectURL(file));
                    e.target.value = "";
                  }}
                />
                {qrError && <p className="text-xs text-red-500 mt-1">{qrError}</p>}
                <p className="text-xs text-stone-400 mt-1">Screenshot of your TnG or DuitNow &quot;Receive Money&quot; QR. You can update this later in your seller dashboard.</p>
              </div>

              {/* Bank transfer fallback */}
              <div className="border-t border-stone-100 pt-4">
                <label className="block text-sm font-medium text-stone-700 mb-1">Bank / E-wallet (optional fallback)</label>
                <p className="text-xs text-stone-400 mb-3">For buyers who prefer manual transfer instead of QR scan.</p>
                <div className="space-y-3">
                  <select value={payForm.bank} onChange={(e) => setPayForm((f) => ({ ...f, bank: e.target.value }))} className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50">
                    <option value="">Select bank / e-wallet...</option>
                    {["Maybank", "CIMB", "Public Bank", "RHB", "Hong Leong", "AmBank", "Touch 'n Go eWallet", "Boost", "GrabPay"].map((b) => <option key={b}>{b}</option>)}
                  </select>
                  <input value={payForm.accountName} onChange={(e) => setPayForm((f) => ({ ...f, accountName: e.target.value }))} placeholder="Account holder name" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" />
                  <input value={payForm.accountNo} onChange={(e) => setPayForm((f) => ({ ...f, accountNo: e.target.value }))} placeholder="Account / e-wallet number" className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50" />
                </div>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={payForm.agreed} onChange={(e) => setPayForm((f) => ({ ...f, agreed: e.target.checked }))} className="accent-[#1C3270] mt-0.5" />
                <span className="text-sm text-stone-600">
                  I agree to the seller <a href="/terms" className="text-[#1C3270] hover:underline">Terms of Use</a> and understand that payments are collected directly from buyers — not via the platform.
                </span>
              </label>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="font-bold text-stone-900 text-lg mb-1" style={{ fontFamily: "Lora, serif" }}>Review & Submit</h2>
            <p className="text-stone-500 text-sm mb-5">Check your details before submitting for admin approval.</p>
            <div className="space-y-3">
              {[
                ["Shop Name", shopForm.name],
                ["Category", shopForm.category],
                ["Shop Type", shopForm.shopType === "product" ? "Products" : shopForm.shopType === "service" ? "Services" : "Products + Services"],
                ["Pickup Location", shopForm.pickup],
                ["Bio", shopForm.bio],
                ...(payForm.bank ? [["Bank / E-wallet", `${payForm.bank}${payForm.accountName ? " — " + payForm.accountName : ""}`]] : []),
                ...(qrPreview ? [["Payment QR", "✓ Uploaded"]] : [["Payment QR", "Not uploaded (can add later)"]]),
              ].map(([label, val]) => (
                <div key={label} className="flex items-start gap-2 p-3 bg-stone-50 rounded-lg border border-stone-100 text-sm">
                  <span className="text-stone-400 w-32 flex-shrink-0">{label}</span>
                  <span className="font-medium text-stone-900">{val || "—"}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              ⏳ After submission, admin will review your shop within 1–2 business days. You'll be notified by email.
            </div>
          </div>
        )}

        {submitError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {submitError}
          </div>
        )}

        <div className="flex items-center gap-3 mt-6">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || submitting}
            className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {step < 3 ? "Continue →" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}

function isMissingOptionalPayoutColumn(message: string) {
  const lower = message.toLowerCase();
  return ["bank_name", "account_name", "account_number"].some((column) => lower.includes(column));
}
