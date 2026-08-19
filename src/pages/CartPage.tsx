import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { ensureBuyerProfile } from "../lib/profiles";
import { uploadImage, validateImageFile } from "../lib/uploadImage";
import {
  fetchMultiShopPaymentInfo,
  confirmPaymentByBuyer,
  notifySellerNewOrder,
  notifyBuyerOrderConfirmed,
  type ShopPaymentInfo,
} from "../lib/payments";

// ─── Types ────────────────────────────────────────────────────────────────────

type PaymentTiming = "now" | "on_pickup";

type GroupedCart = {
  shopId: string;
  shopName: string;
  shopSlug: string;
  items: ReturnType<typeof useApp>["cart"];
  note: string;
  pickupTime: string;
};

type CreatedOrder = GroupedCart & {
  id: string;
  orderCode: string;
  subtotal: number;
  total: number;
  paymentTiming: PaymentTiming;
  shopPaymentInfo?: ShopPaymentInfo | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateOrderCode() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `AIU-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

function ShopHasPaymentMethod(info: ShopPaymentInfo | null | undefined) {
  if (!info) return false;
  return !!(info.payment_qr_url || info.bank_name || info.account_name || info.account_number);
}

// ─── Sub-component: QR Payment Screen ─────────────────────────────────────────

function QRPaymentScreen({
  order,
  totalOrders,
  currentIndex,
  onPaid,
  paying,
}: {
  order: CreatedOrder;
  totalOrders: number;
  currentIndex: number;
  onPaid: (proofFile: File) => void;
  paying: boolean;
}) {
  const info = order.shopPaymentInfo;
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState("");
  const [proofError, setProofError] = useState("");
  return (
    <div className="max-w-md mx-auto">
      {totalOrders > 1 && (
        <div className="mb-4 px-4 py-2 bg-[#1C3270]/10 rounded-lg text-sm text-[#1C3270] font-medium text-center">
          Payment {currentIndex + 1} of {totalOrders}: {order.shopName}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
        <div className="bg-[#1C3270] px-6 py-5 text-white text-center">
          <div className="text-4xl font-bold mb-1">RM {order.total.toFixed(2)}</div>
          <div className="text-sm opacity-80">Pay directly to {order.shopName}</div>
          <div className="text-xs opacity-60 mt-1 font-mono">{order.orderCode}</div>
        </div>

        <div className="p-6 space-y-5">
          {/* QR Code */}
          {info?.payment_qr_url ? (
            <div className="text-center">
              <p className="text-xs text-stone-500 mb-3">
                Scan with TnG, DuitNow, or your banking app
              </p>
              <div className="inline-block border-4 border-[#1C3270]/20 rounded-xl p-2 bg-white shadow-sm">
                <img
                  src={info.payment_qr_url}
                  alt={`${order.shopName} payment QR`}
                  className="w-52 h-52 object-contain mx-auto rounded-lg"
                />
              </div>
            </div>
          ) : (
            <div className="bg-stone-50 border border-dashed border-stone-300 rounded-xl p-4 text-center text-sm text-stone-400">
              📵 No QR code set up — use bank transfer below
            </div>
          )}

          {/* Bank transfer fallback */}
          {(info?.bank_name || info?.account_name || info?.account_number) && (
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 space-y-2">
              <div className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                Bank Transfer (alternative)
              </div>
              {info.bank_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Bank</span>
                  <span className="font-medium text-stone-900">{info.bank_name}</span>
                </div>
              )}
              {info.account_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Account Name</span>
                  <span className="font-medium text-stone-900">{info.account_name}</span>
                </div>
              )}
              {info.account_number && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Account No.</span>
                  <span className="font-mono font-bold text-stone-900 select-all">{info.account_number}</span>
                </div>
              )}
              <div className="flex justify-between text-sm border-t border-stone-200 pt-2 mt-1">
                <span className="text-stone-500">Amount</span>
                <span className="font-bold text-[#1C3270]">RM {order.total.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <p className="font-semibold mb-1">How to pay</p>
            <p>
              Scan this QR code or make a bank transfer to{" "}
              <span className="font-semibold">{order.shopName}</span> directly.
              Once you&apos;ve completed the payment in your banking or TnG app,
              tap &quot;I&apos;ve Paid&quot; below.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="font-semibold text-sm text-amber-900 mb-1">Payment proof required</p>
            <p className="text-xs text-amber-800 mb-3">Upload a screenshot of your successful bank/TnG/DuitNow payment before you can confirm “I've Paid”.</p>
            <label className="block border-2 border-dashed border-amber-300 rounded-lg p-4 text-center cursor-pointer hover:bg-amber-100/50">
              {proofPreview ? <img src={proofPreview} alt="Payment proof preview" className="max-h-40 mx-auto rounded-lg object-contain" /> : <span className="text-xs text-amber-800">📸 Choose payment proof image</span>}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const err = validateImageFile(file); if (err) { setProofError(err); return; } setProofError(""); setProofFile(file); setProofPreview(URL.createObjectURL(file)); e.target.value = ""; }} />
            </label>
            {proofError && <p className="text-xs text-red-500 mt-1">{proofError}</p>}
          </div>

          <p className="text-xs text-stone-400 text-center">
            This payment goes directly to the seller — not through the platform. The uploaded proof is sent with your order so the seller can verify the transaction.
          </p>

          <button
            onClick={() => proofFile && onPaid(proofFile)}
            disabled={paying || !proofFile}
            className="w-full py-4 bg-[#44B444] text-white rounded-xl font-bold text-base hover:bg-[#2E8A2E] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {paying ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Confirming…
              </>
            ) : (
              "✓ I've Paid"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CartPage() {
  const { cart, removeFromCart, updateQty, clearCart, user, openAuthModal } = useApp();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pickupTimes, setPickupTimes] = useState<Record<string, string>>({});
  const [paymentTimings, setPaymentTimings] = useState<Record<string, PaymentTiming>>({});

  const [step, setStep] = useState<"cart" | "checkout" | "qr" | "success">(
    searchParams.get("buy") === "1" ? "checkout" : "cart"
  );

  const [processing, setProcessing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const [createdOrders, setCreatedOrders] = useState<CreatedOrder[]>([]);
  // "pay now" orders processed sequentially in QR step
  const [qrOrders, setQrOrders] = useState<CreatedOrder[]>([]);
  const [qrIndex, setQrIndex] = useState(0);

  // Group cart by shop
  const grouped: GroupedCart[] = Object.values(
    cart.reduce((acc, item) => {
      if (!acc[item.shopId]) {
        acc[item.shopId] = {
          shopId: item.shopId,
          shopName: item.shopName,
          shopSlug: item.shopSlug,
          items: [],
          note: notes[item.shopId] ?? "",
          pickupTime: pickupTimes[item.shopId] ?? "",
        };
      }
      acc[item.shopId].items.push(item);
      return acc;
    }, {} as Record<string, GroupedCart>)
  );

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  // ── Auth gate ────────────────────────────────────────────────────────────────

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Sign in to view your cart</h2>
        <p className="text-stone-500 mb-4">Your cart is saved when you log in.</p>
        <button onClick={() => openAuthModal("login")} className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium">Log in</button>
      </div>
    );
  }

  // ── Empty cart ───────────────────────────────────────────────────────────────

  if (cart.length === 0 && (step === "cart" || step === "checkout")) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">🛒</div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Your cart is empty</h2>
        <p className="text-stone-500 mb-4">Add products from student shops to get started.</p>
        <Link to="/browse" className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium text-sm">Browse Shops</Link>
      </div>
    );
  }

  // ── Success screen ───────────────────────────────────────────────────────────

  if (step === "success") {
    const payNowOrders = createdOrders.filter((o) => o.paymentTiming === "now");
    const pickupOrders = createdOrders.filter((o) => o.paymentTiming === "on_pickup");
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Orders Placed!</h2>
          <p className="text-stone-500 mb-6">
            {payNowOrders.length > 0 && pickupOrders.length > 0
              ? "Your payments were reported. Cash/QR orders are due on pickup."
              : payNowOrders.length > 0
              ? "Your payments were reported. Each seller will verify receipt and prepare your orders."
              : "Your orders are in! Pay each seller on pickup or delivery."}
          </p>

          <div className="text-left space-y-3 mb-6">
            {createdOrders.map((o) => (
              <div key={o.shopId} className="bg-stone-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-stone-900 text-sm">{o.shopName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-400">{o.orderCode}</span>
                    {o.paymentTiming === "on_pickup" ? (
                      <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full">Pay on pickup</span>
                    ) : (
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">✓ Payment reported</span>
                    )}
                  </div>
                </div>
                {o.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm text-stone-600">
                    <span>{item.quantity}× {item.name}</span>
                    <span className="font-medium">RM {(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-stone-200 mt-2 pt-2 flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-[#1C3270]">RM {o.total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => window.print()}
              className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              🖨️ Print Receipt
            </button>
            <Link
              to="/orders"
              className="flex-1 py-2.5 bg-[#1C3270] text-white rounded-xl text-sm font-semibold hover:bg-[#0F1F4A] transition-colors text-center"
            >
              View My Orders
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── QR payment step ──────────────────────────────────────────────────────────

  if (step === "qr" && qrOrders.length > 0) {
    const currentOrder = qrOrders[qrIndex];

    async function handleIvePaid(proofFile: File) {
      if (!user || !currentOrder) return;
      setPaying(true);
      setPaymentError("");
      try {
        const ext = proofFile.name.split(".").pop() || "jpg";
        const proofUrl = await uploadImage("payment-proofs", `${user.id}/${currentOrder.id}/proof-${Date.now()}.${ext}`, proofFile);
        await confirmPaymentByBuyer(currentOrder.id, proofUrl);
        await notifySellerNewOrder(currentOrder.shopId, user.name, currentOrder.total);
        await notifyBuyerOrderConfirmed(user.id, currentOrder.shopName, currentOrder.total);
      } catch (err) {
        setPaymentError(err instanceof Error ? err.message : "Could not confirm payment");
        setPaying(false);
        return;
      }
      setPaying(false);

      if (qrIndex < qrOrders.length - 1) {
        setQrIndex((i) => i + 1);
      } else {
        setStep("success");
      }
    }

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>Pay for your order</h1>
        </div>

        {paymentError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            <p className="font-medium">{paymentError}</p>

          </div>
        )}

        <QRPaymentScreen
          order={currentOrder}
          totalOrders={qrOrders.length}
          currentIndex={qrIndex}
          onPaid={(proofFile) => void handleIvePaid(proofFile)}
          paying={paying}
        />
      </div>
    );
  }

  // ── Cart + Checkout steps ────────────────────────────────────────────────────

  async function handlePlaceOrder() {
    if (!user || grouped.length === 0) return;
    setProcessing(true);
    setPaymentError("");

    const profileReady = await ensureBuyerProfile(user);
    if (!profileReady.ok) {
      setProcessing(false);
      setPaymentError(`Could not prepare your buyer profile: ${profileReady.message}`);
      return;
    }

    // Fetch all shop payment info upfront
    const allShopIds = grouped.map((g) => g.shopId);
    let shopPaymentMap: Record<string, ShopPaymentInfo> = {};
    try {
      shopPaymentMap = await fetchMultiShopPaymentInfo(allShopIds);
    } catch {
      // non-fatal — we'll still validate below
    }

    // Validate: any "pay now" shop must have at least one payment method
    const payNowGroups = grouped.filter((g) => (paymentTimings[g.shopId] ?? "now") === "now");
    for (const g of payNowGroups) {
      const info = shopPaymentMap[g.shopId];
      if (!ShopHasPaymentMethod(info)) {
        setPaymentError(
          `"${g.shopName}" hasn't set up a payment method yet. Choose "Pay on pickup" for this shop, or ask the seller to add their QR / bank details.`
        );
        setProcessing(false);
        return;
      }
    }

    // Create all orders
    const insertedOrders: CreatedOrder[] = [];
    for (const group of grouped) {
      const timing: PaymentTiming = paymentTimings[group.shopId] ?? "now";
      const groupSubtotal = group.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const orderCode = generateOrderCode();

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          order_code: orderCode,
          buyer_id: user.id,
          shop_id: group.shopId,
          type: "product",
          status: "pending",
          subtotal: groupSubtotal,
          platform_fee: 0,
          total: groupSubtotal,
          payment_method: timing === "now" ? "qr_bank_transfer" : "cash_on_pickup",
          payment_status: "unpaid",
          payment_timing: timing,
          note: notes[group.shopId] || null,
          pickup_time: pickupTimes[group.shopId] || null,
        })
        .select("id")
        .single();

      if (orderError || !order) {
        // Roll back any orders created before this failure
        for (const prev of insertedOrders) {
          await supabase.from("orders").delete().eq("id", prev.id);
        }
        setProcessing(false);
        setPaymentError(orderError?.message || "Could not create order");
        return;
      }

      const { error: itemsError } = await supabase.from("order_items").insert(
        group.items.map((item) => ({
          order_id: order.id,
          product_id: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        }))
      );

      if (itemsError) {
        await supabase.from("orders").delete().eq("id", order.id);
        for (const prev of insertedOrders) {
          await supabase.from("orders").delete().eq("id", prev.id);
        }
        setProcessing(false);
        setPaymentError(itemsError.message || "Could not add order items");
        return;
      }

      insertedOrders.push({
        ...group,
        id: order.id,
        orderCode,
        subtotal: groupSubtotal,
        total: groupSubtotal,
        paymentTiming: timing,
        shopPaymentInfo: shopPaymentMap[group.shopId] ?? null,
      });
    }

    clearCart();
    setCreatedOrders(insertedOrders);
    setProcessing(false);

    const payNow = insertedOrders.filter((o) => o.paymentTiming === "now");
    if (payNow.length === 0) {
      setStep("success");
    } else {
      setQrOrders(payNow);
      setQrIndex(0);
      setStep("qr");
    }
  }

  const stepIndicators = ["Cart", "Checkout", "Pay", "Done"];
  const stepIndex = step === "cart" ? 0 : step === "checkout" ? 1 : step === "qr" ? 2 : 3;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-stone-900" style={{ fontFamily: "Lora, serif" }}>
            {step === "cart" ? "My Cart" : step === "checkout" ? "Checkout" : "Payment"}
          </h1>
          {step === "checkout" && (
            <button onClick={() => setStep("cart")} className="text-sm text-[#1C3270] hover:text-[#0F1F4A] font-medium">
              ← Back to cart
            </button>
          )}
        </div>
        {step === "cart" && (
          <Link to="/browse" className="text-sm text-stone-500 hover:text-[#1C3270] transition-colors flex items-center gap-1">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Continue shopping
          </Link>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {stepIndicators.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === stepIndex ? "bg-[#1C3270] text-white" : i < stepIndex ? "bg-green-500 text-white" : "bg-stone-200 text-stone-500"}`}>
              {i < stepIndex ? "✓" : i + 1}
            </div>
            <span className="text-stone-500">{s}</span>
            {i < stepIndicators.length - 1 && <span className="text-stone-300">—</span>}
          </div>
        ))}
      </div>

      {paymentError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">{paymentError}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-4">
          {/* ── CART STEP ── */}
          {step === "cart" && (
            <>
              {grouped.map((group) => {
                const groupTotal = group.items.reduce((s, i) => s + i.price * i.quantity, 0);
                return (
                  <div key={group.shopId} className="bg-white dark:bg-[#112038] rounded-2xl border border-stone-100 dark:border-[#1C3058] overflow-hidden">
                    <div className="px-5 py-3 bg-stone-50 dark:bg-[#0E1A2E] border-b border-stone-100 dark:border-[#1C3058] flex items-center justify-between">
                      <Link to={`/shop/${group.shopSlug}`} className="font-semibold text-stone-900 dark:text-[#E2EAF6] text-sm hover:text-[#1C3270]">
                        🏪 {group.shopName}
                      </Link>
                      <span className="text-sm font-semibold text-stone-600">RM {groupTotal.toFixed(2)}</span>
                    </div>

                    <div className="divide-y divide-stone-50 dark:divide-[#1C3058]">
                      {group.items.map((item) => (
                        <div key={item.id} className="px-4 py-3">
                          <div className="flex items-start gap-3">
                            <img src={item.image} alt={item.name} className="w-14 h-14 rounded-lg object-cover bg-stone-100 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-medium text-sm text-stone-900 dark:text-[#E2EAF6] line-clamp-2 flex-1">{item.name}</div>
                                <button onClick={() => removeFromCart(item.id)} className="text-stone-300 hover:text-red-400 transition-colors text-base flex-shrink-0 leading-none mt-0.5">✕</button>
                              </div>
                              <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                                <span>📍</span><span className="truncate">{item.pickupLocation}</span>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="font-semibold text-[#1C3270] text-sm">RM {item.price.toFixed(2)}</div>
                                <div className="flex items-center border border-stone-200 dark:border-[#1C3058] rounded-lg overflow-hidden">
                                  <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-7 h-7 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-[#0E1A2E] text-stone-600 text-sm">−</button>
                                  <span className="w-7 text-center text-sm font-semibold dark:text-[#E2EAF6]">{item.quantity}</span>
                                  <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center hover:bg-stone-50 dark:hover:bg-[#0E1A2E] text-stone-600 text-sm">+</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Per-shop fields */}
                    <div className="px-5 pb-4 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-500 mb-1">Note for {group.shopName} (optional)</label>
                        <input
                          value={notes[group.shopId] ?? ""}
                          onChange={(e) => setNotes((n) => ({ ...n, [group.shopId]: e.target.value }))}
                          placeholder="e.g., Leave at hostel gate, extra spicy please..."
                          className="w-full px-3 py-2 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#A8C0D8]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-500 dark:text-[#6888A8] mb-1">Preferred pickup time</label>
                        <input
                          type="datetime-local"
                          value={pickupTimes[group.shopId] ?? ""}
                          onChange={(e) => setPickupTimes((pt) => ({ ...pt, [group.shopId]: e.target.value }))}
                          className="w-full px-3 py-2 border border-stone-200 dark:border-[#1C3058] rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#A8C0D8]"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex gap-3">
                <Link to="/browse" className="flex-1 py-2.5 border border-stone-200 dark:border-[#1C3058] rounded-xl text-sm font-medium text-center text-stone-700 dark:text-[#A8C0D8] hover:bg-stone-50 dark:hover:bg-[#0E1A2E] transition-colors">
                  ← Continue Shopping
                </Link>
              </div>
            </>
          )}

          {/* ── CHECKOUT STEP ── */}
          {step === "checkout" && (
            <>
              {grouped.map((group) => {
                const timing: PaymentTiming = paymentTimings[group.shopId] ?? "now";
                const groupTotal = group.items.reduce((s, i) => s + i.price * i.quantity, 0);
                return (
                  <div key={group.shopId} className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
                    <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                      <span className="font-semibold text-stone-900 text-sm">🏪 {group.shopName}</span>
                      <span className="text-sm font-semibold text-[#1C3270]">RM {groupTotal.toFixed(2)}</span>
                    </div>

                    <div className="px-5 py-4">
                      <div className="text-xs font-medium text-stone-500 mb-2">How will you pay?</div>
                      <div className="grid grid-cols-2 gap-3">
                        {(
                          [
                            {
                              id: "now" as PaymentTiming,
                              icon: "📱",
                              label: "Pay now",
                              desc: "QR code or bank transfer",
                            },
                            {
                              id: "on_pickup" as PaymentTiming,
                              icon: "🤝",
                              label: "Pay on pickup",
                              desc: "Cash or QR when you collect",
                            },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => setPaymentTimings((p) => ({ ...p, [group.shopId]: opt.id }))}
                            className={`text-left p-3 rounded-xl border-2 transition-colors ${timing === opt.id ? "border-[#1C3270] bg-[#1C3270]/5" : "border-stone-200 hover:border-stone-300"}`}
                          >
                            <div className="text-xl mb-1">{opt.icon}</div>
                            <div className={`text-sm font-semibold ${timing === opt.id ? "text-[#1C3270]" : "text-stone-900"}`}>{opt.label}</div>
                            <div className="text-xs text-stone-400">{opt.desc}</div>
                          </button>
                        ))}
                      </div>

                      {timing === "now" && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                          💡 You&apos;ll see the seller&apos;s QR code on the next screen. Pay directly to them, then tap &quot;I&apos;ve Paid&quot;.
                        </div>
                      )}
                      {timing === "on_pickup" && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                          💵 No payment needed now. Bring cash or be ready to scan their QR when you pick up.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Order summary sidebar */}
        <div>
          <div className="bg-white dark:bg-[#112038] rounded-2xl border border-stone-100 dark:border-[#1C3058] p-5 sticky top-20">
            <h3 className="font-bold text-stone-900 dark:text-[#E2EAF6] mb-4" style={{ fontFamily: "Lora, serif" }}>Order Summary</h3>
            <div className="space-y-2 text-sm mb-4">
              {cart.map((item) => (
                <div key={item.id} className="flex justify-between text-stone-600 dark:text-[#A8C0D8]">
                  <span className="line-clamp-1 flex-1 mr-2">{item.name} ×{item.quantity}</span>
                  <span className="flex-shrink-0">RM {(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-100 dark:border-[#1C3058] pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between font-bold text-base pt-1">
                <span>Total</span>
                <span style={{ color: "#1C3270" }}>RM {subtotal.toFixed(2)}</span>
              </div>
              <div className="text-xs text-stone-400 mt-1">
                Money goes directly to each seller — no platform fee.
              </div>
            </div>

            {step === "cart" && (
              <button
                onClick={() => setStep("checkout")}
                className="w-full mt-5 py-3 bg-[#1C3270] text-white rounded-xl font-bold text-sm hover:bg-[#0F1F4A] transition-colors"
              >
                Proceed to Checkout →
              </button>
            )}

            {step === "checkout" && (
              <button
                onClick={() => void handlePlaceOrder()}
                disabled={processing}
                className="w-full mt-5 py-3.5 bg-[#1C3270] text-white rounded-xl font-bold text-sm hover:bg-[#0F1F4A] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Placing orders…
                  </>
                ) : (
                  "Place Order →"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
