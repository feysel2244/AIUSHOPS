import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Badge from "../components/ui/Badge";
import StarRating from "../components/ui/StarRating";
import { useApp } from "../context/AppContext";
import { supabase } from "../lib/supabase";
import { uploadImage } from "../lib/uploadImage";
import { refreshShopRating } from "../lib/reviews";
import {
  fetchShopPaymentInfo,
  confirmPaymentByBuyer,
  notifySellerNewOrder,
  notifyBuyerOrderConfirmed,
  type ShopPaymentInfo,
} from "../lib/payments";

type OrderItem = {
  id: string;
  product_id: string | null;
  service_id: string | null;
  name: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  order_code: string;
  shop_id: string;
  type: "product" | "service";
  status: string;
  total: number;
  payment_method: string | null;
  payment_status: string | null;
  payment_timing: string | null;
  payment_confirmed_by: string | null;
  payment_verified_by_seller: boolean;
  booking_date?: string | null;
  booking_time?: string | null;
  created_at: string;
  shops: { name: string; slug: string; owner?: { whatsapp?: string | null } | null } | null;
  order_items: OrderItem[];
};

const STATUS_MAP: Record<string, "pending" | "confirmed" | "ready" | "delivered" | "cancelled"> = {
  pending: "pending",
  pending_buyer_approval: "pending",
  confirmed: "confirmed",
  ready: "ready",
  completed: "delivered",
  cancelled: "cancelled",
  rejected: "cancelled",
};

// ── Inline QR payment modal ──────────────────────────────────────────────────

function QRPayModal({
  order,
  info,
  onPaid,
  onClose,
}: {
  order: Order;
  info: ShopPaymentInfo;
  onPaid: () => void;
  onClose: () => void;
}) {
  const { user } = useApp();
  const [paying, setPaying] = useState(false);
  const [err, setErr] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

  async function handlePaid() {
    if (!user) return;
    if (!receiptFile) {
      setErr("Please upload your payment receipt before confirming payment.");
      return;
    }
    setPaying(true);
    setErr("");
    try {
      const paymentProofUrl = await uploadImage("payment-proofs", "path", receiptFile);

      // confirmPaymentByBuyer saves the proof URL + updates order status in one call
      await confirmPaymentByBuyer(order.id, paymentProofUrl);
      await notifySellerNewOrder(order.shop_id, user.name, Number(order.total));
      await notifyBuyerOrderConfirmed(user.id, order.shops?.name ?? "the seller", Number(order.total));
      onPaid();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not confirm payment");
      setPaying(false);
    }
  }

  const hasPayment = info.payment_qr_url || info.bank_name || info.account_name;

  function handleReceiptChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErr("Please upload an image of your payment receipt.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setErr("Payment receipt must be smaller than 8MB.");
      return;
    }
    setErr("");
    setReceiptFile(file);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview(URL.createObjectURL(file));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-[#1C3270] px-6 py-4 text-white text-center">
          <div className="text-3xl font-bold mb-0.5">RM {Number(order.total).toFixed(2)}</div>
          <div className="text-sm opacity-80">Pay {order.shops?.name}</div>
          <div className="text-xs opacity-60 font-mono mt-0.5">{order.order_code}</div>
        </div>

        <div className="p-5 space-y-4">
          {!hasPayment && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              ⚠️ This shop hasn't set up a payment method yet. Contact the seller via WhatsApp to arrange payment.
            </div>
          )}

          {info.payment_qr_url && (
            <div className="text-center">
              <p className="text-xs text-stone-500 mb-2">Scan with TnG or banking app</p>
              <div className="inline-block border-4 border-[#1C3270]/20 rounded-xl p-1.5 bg-white shadow-sm">
                <img src={info.payment_qr_url} alt="Payment QR" className="w-44 h-44 object-contain rounded-lg mx-auto" />
              </div>
            </div>
          )}

          {(info.bank_name || info.account_name || info.account_number) && (
            <div className="bg-stone-50 rounded-xl border border-stone-200 p-3 space-y-1.5">
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Bank Transfer</div>
              {info.bank_name && <div className="flex justify-between text-sm"><span className="text-stone-500">Bank</span><span className="font-medium">{info.bank_name}</span></div>}
              {info.account_name && <div className="flex justify-between text-sm"><span className="text-stone-500">Name</span><span className="font-medium">{info.account_name}</span></div>}
              {info.account_number && <div className="flex justify-between text-sm"><span className="text-stone-500">Acc No.</span><span className="font-mono font-bold select-all">{info.account_number}</span></div>}
              <div className="flex justify-between text-sm border-t border-stone-200 pt-1.5 mt-1"><span className="text-stone-500">Amount</span><span className="font-bold text-[#1C3270]">RM {Number(order.total).toFixed(2)}</span></div>
            </div>
          )}

          {hasPayment && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <div className="text-sm font-semibold text-blue-900 mb-1">📸 Upload payment proof</div>
                <p className="text-xs text-blue-700 mb-3">After paying, upload the successful TnG or banking-app screenshot so the seller can verify your payment.</p>
                <label className="block border-2 border-dashed border-blue-200 rounded-xl p-3 text-center cursor-pointer hover:border-[#1C3270] bg-white">
                  {receiptPreview ? (
                    <img src={receiptPreview} alt="Payment receipt preview" className="max-h-36 mx-auto rounded-lg object-contain" />
                  ) : (
                    <div className="text-sm text-stone-400">📷 Click to upload payment screenshot</div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      handleReceiptChange(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                {receiptFile && <div className="text-xs text-green-700 mt-2 text-center">✓ Receipt selected</div>}
              </div>
              <p className="text-xs text-stone-400 text-center">
                Pay directly to the seller, upload your payment proof, then tap &quot;I&apos;ve Paid&quot;. The seller will verify receipt.
              </p>
            </>
          )}

          {err && <div className="text-xs text-red-500 text-center">{err}</div>}

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border border-stone-200 rounded-xl text-sm font-medium">
              Cancel
            </button>
            {hasPayment && (
              <button
                onClick={() => void handlePaid()}
                disabled={paying || !receiptFile}
                className="flex-1 py-2.5 bg-[#44B444] text-white rounded-xl text-sm font-bold hover:bg-[#2E8A2E] disabled:opacity-60"
              >
                {paying ? "Confirming…" : "✓ I've Paid"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function MyOrdersPage() {
  const { user, openAuthModal } = useApp();
  const [tab, setTab] = useState<"active" | "completed" | "cancelled">("active");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewModal, setReviewModal] = useState<Order | null>(null);
  const [reviewItem, setReviewItem] = useState<OrderItem | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [submitted, setSubmitted] = useState<string[]>([]);

  // QR pay modal state
  const [payModal, setPayModal] = useState<{ order: Order; info: ShopPaymentInfo } | null>(null);
  const [loadingPayInfo, setLoadingPayInfo] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    void loadOrders();
  }, [user?.id]);

  async function loadOrders() {
    if (!user) return;
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("orders")
      .select("id,order_code,shop_id,type,status,total,payment_method,payment_status,payment_timing,payment_confirmed_by,payment_verified_by_seller,booking_date,booking_time,created_at,shops(name,slug,owner:profiles(whatsapp)),order_items(id,product_id,service_id,name,price,quantity)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (queryError) { setError(queryError.message); return; }
    const orderRows = (data ?? []) as unknown as Order[];
    setOrders(orderRows);

    const { data: reviewRows } = await supabase
      .from("reviews")
      .select("order_id,product_id,service_id")
      .eq("author_id", user.id);
    const reviewedKeys = (reviewRows ?? [])
      .map((row) => row.product_id ? `product:${row.product_id}` : row.service_id ? `service:${row.service_id}` : row.order_id ? `order:${row.order_id}` : null)
      .filter(Boolean) as string[];
    setSubmitted(reviewedKeys);
  }

  async function acceptProposedTime(orderId: string) {
    if (!user) return;
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "confirmed" })
      .eq("id", orderId)
      .eq("buyer_id", user.id);
    
    if (updateError) {
      console.error("Error accepting time:", updateError.message);
      setError("Could not accept the proposed time: " + updateError.message);
      return;
    }
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "confirmed" } : o));
  }

  async function cancelOrder(order: Order) {
    if (order.status !== "pending" && order.status !== "pending_buyer_approval") return;
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .eq("buyer_id", user!.id);
    if (updateError) { setError(updateError.message); return; }
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "cancelled" } : o));
  }

  async function handleReviewSubmit() {
    if (!rating || !reviewModal || !reviewItem || !user) return;
    const itemKey = reviewItem.product_id ? `product:${reviewItem.product_id}` : reviewItem.service_id ? `service:${reviewItem.service_id}` : `order:${reviewModal.id}`;
    if (submitted.includes(itemKey)) {
      setError("You have already reviewed this item.");
      return;
    }

    const { error: reviewError } = await supabase.from("reviews").insert({
      author_id: user.id,
      shop_id: reviewModal.shop_id,
      product_id: reviewItem.product_id ?? null,
      service_id: reviewItem.service_id ?? null,
      order_id: reviewModal.id,
      rating,
      text: reviewText || null,
    });
    if (reviewError) { setError(reviewError.message); return; }

    try {
      await refreshShopRating(reviewModal.shop_id);
    } catch (ratingError) {
      setError(ratingError instanceof Error ? ratingError.message : "Review saved, but the shop rating could not be updated.");
    }

    setSubmitted((keys) => [...keys, itemKey]);
    setReviewModal(null);
    setReviewItem(null);
    setRating(0);
    setReviewText("");
  }

  async function openPayModal(order: Order) {
    setLoadingPayInfo(order.id);
    try {
      const info = await fetchShopPaymentInfo(order.shop_id);
      setPayModal({ order, info: info ?? { name: order.shops?.name ?? "", payment_qr_url: null, bank_name: null, account_name: null, account_number: null } });
    } catch {
      setError("Could not load shop payment details");
    }
    setLoadingPayInfo(null);
  }

  function handlePaymentConfirmed(orderId: string) {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, payment_status: "paid", payment_confirmed_by: "buyer", status: "confirmed" }
          : o
      )
    );
    setPayModal(null);
  }

  function paymentLabel(order: Order) {
    if (order.payment_timing === "on_pickup" && order.payment_status !== "paid") {
      return <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">💵 Pay on pickup — RM {Number(order.total).toFixed(2)}</span>;
    }
    if (order.payment_confirmed_by === "buyer" && !order.payment_verified_by_seller) {
      return <Badge variant="payment_reported" />;
    }
    if (order.payment_status === "paid") {
      return <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">✓ Paid</span>;
    }
    return null;
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <div className="text-5xl mb-4">📦</div>
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "Lora, serif" }}>Sign in to view your orders</h2>
        <button onClick={() => openAuthModal("login")} className="px-6 py-2 bg-[#1C3270] text-white rounded-lg font-medium text-sm">Log in</button>
      </div>
    );
  }

  const activeOrders = orders.filter((o) => ["pending", "pending_buyer_approval", "confirmed", "ready"].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === "completed");
  const cancelledOrders = orders.filter((o) => ["cancelled", "rejected"].includes(o.status));
  const visibleOrders = tab === "active" ? activeOrders : tab === "completed" ? completedOrders : cancelledOrders;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: "Lora, serif" }}>My Orders</h1>

      <div className="flex gap-1 mb-6 bg-stone-100 rounded-lg p-1 w-fit">
        {(["active", "completed", "cancelled"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${tab === t ? "bg-white text-[#1C3270] shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
          >
            {t}
            <span className="ml-1.5 text-xs opacity-60">
              ({t === "active" ? activeOrders.length : t === "completed" ? completedOrders.length : cancelledOrders.length})
            </span>
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="text-center py-16 text-stone-400">Loading orders…</div>
      ) : visibleOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-stone-100">
          <div className="text-4xl mb-3">{tab === "active" ? "⏳" : tab === "completed" ? "✅" : "❌"}</div>
          <h3 className="font-bold text-stone-900 mb-1" style={{ fontFamily: "Lora, serif" }}>No {tab} orders</h3>
          <p className="text-stone-500 text-sm mb-4">
            {tab === "active" ? "Your active orders will appear here." : tab === "completed" ? "Completed orders will show up here." : "Cancelled orders will be listed here."}
          </p>
          {tab === "active" && <Link to="/browse" className="px-5 py-2 bg-[#1C3270] text-white rounded-lg text-sm font-medium inline-block">Browse Shops</Link>}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="font-semibold text-stone-900 text-sm">{order.shops?.name ?? "Shop"}</span>
                  <span className="mx-2 text-stone-300">·</span>
                  <span className="text-xs font-mono text-stone-400">{order.order_code}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {order.type === "service" && <span className="text-xs bg-purple-50 text-purple-600 border border-purple-200 px-2 py-0.5 rounded-full">Service Booking</span>}
                  <Badge variant={STATUS_MAP[order.status] ?? "pending"} />
                  {paymentLabel(order)}
                </div>
              </div>

              <div className="px-5 py-4">
                {order.order_items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm text-stone-700 mb-1">
                    <span>{item.quantity}× {item.name}</span>
                    <span className="font-medium">RM {(Number(item.price) * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
                <div className="border-t border-stone-100 mt-2 pt-2 flex justify-between font-bold text-stone-900 text-sm">
                  <span>Total</span>
                  <span style={{ color: "#1C3270" }}>RM {Number(order.total).toFixed(2)}</span>
                </div>
                <div className="text-xs text-stone-400 mt-1">{new Date(order.created_at).toLocaleDateString("en-MY")}</div>
              </div>

              <div className="px-5 pb-4 flex flex-wrap gap-2">
                {order.shops?.owner?.whatsapp && (
                  <a href={`https://wa.me/${order.shops.owner.whatsapp}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 text-xs font-semibold bg-[#25D366] text-white rounded-lg hover:bg-[#1ebe5d] transition-colors flex items-center gap-1">
                    💬 Message Seller
                  </a>
                )}

                {order.status === "pending" && (
                  <button onClick={() => cancelOrder(order)} className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                    Cancel Order
                  </button>
                )}

                {order.status === "pending_buyer_approval" && (
                  <div className="w-full mt-2 p-3 bg-purple-50 border border-purple-200 rounded-xl text-sm">
                    <p className="font-semibold text-purple-800 mb-1">Seller proposed a new time:</p>
                    <p className="text-purple-700 mb-3">
                      {order.booking_date ? new Date(`${order.booking_date}T00:00:00`).toLocaleDateString("en-MY", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : ""} {order.booking_time ? `at ${order.booking_time}` : ""}
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => void acceptProposedTime(order.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700">
                        Accept Time
                      </button>
                      <button onClick={() => void cancelOrder(order)} className="px-3 py-1.5 border border-red-200 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-50">
                        Decline & Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Pay now button — for unpaid "now" orders or unconfirmed service bookings */}
                {order.payment_status !== "paid" &&
                  order.payment_timing !== "on_pickup" &&
                  ["pending", "confirmed"].includes(order.status) && (
                    <button
                      onClick={() => void openPayModal(order)}
                      disabled={loadingPayInfo === order.id}
                      className="px-3 py-1.5 text-xs font-semibold bg-[#1C3270] text-white rounded-lg hover:bg-[#0F1F4A] transition-colors disabled:opacity-60"
                    >
                      {loadingPayInfo === order.id ? "Loading…" : "Pay now"}
                    </button>
                  )}

                <button onClick={() => setReceipt(order)} className="px-3 py-1.5 text-xs font-medium border border-stone-200 text-stone-600 rounded-lg hover:bg-stone-50 transition-colors">
                  View Receipt
                </button>

                {order.status === "completed" && order.order_items.some((item) => {
                  const key = item.product_id ? `product:${item.product_id}` : item.service_id ? `service:${item.service_id}` : `order:${order.id}`;
                  return !submitted.includes(key);
                }) && (
                  <button onClick={() => { setReviewModal(order); setReviewItem(order.order_items.find((item) => { const key = item.product_id ? `product:${item.product_id}` : item.service_id ? `service:${item.service_id}` : `order:${order.id}`; return !submitted.includes(key); }) || order.order_items[0]); }} className="px-3 py-1.5 text-xs font-semibold bg-[#44B444] text-white rounded-lg hover:bg-[#2E8A2E] transition-colors">
                    ⭐ Rate an item
                  </button>
                )}
                {order.status === "completed" && order.order_items.length > 0 && order.order_items.every((item) => { const key = item.product_id ? `product:${item.product_id}` : item.service_id ? `service:${item.service_id}` : `order:${order.id}`; return submitted.includes(key); }) && <span className="px-3 py-1.5 text-xs text-green-600 bg-green-50 rounded-lg border border-green-200">✓ All items reviewed</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Pay Modal */}
      {payModal && (
        <QRPayModal
          order={payModal.order}
          info={payModal.info}
          onPaid={() => handlePaymentConfirmed(payModal.order.id)}
          onClose={() => setPayModal(null)}
        />
      )}

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReceipt(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-900 text-lg" style={{ fontFamily: "Lora, serif" }}>Receipt</h3>
              <button onClick={() => setReceipt(null)} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
            </div>
            <div className="text-xs text-stone-400 mb-3">{receipt.order_code} · {new Date(receipt.created_at).toLocaleString("en-MY")}</div>
            <div className="space-y-2 mb-4">
              {receipt.order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.quantity}× {item.name}</span>
                  <span>RM {(Number(item.price) * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-stone-100 pt-3 space-y-1 text-sm">
              <div className="flex justify-between font-bold"><span>Total</span><span>RM {Number(receipt.total).toFixed(2)}</span></div>
              <div className="flex justify-between text-stone-400 text-xs">
                <span>Payment</span>
                <span>
                  {receipt.payment_timing === "on_pickup"
                    ? "Cash / QR on pickup"
                    : receipt.payment_confirmed_by === "buyer"
                    ? "Payment reported by buyer"
                    : receipt.payment_status === "paid"
                    ? "Paid"
                    : "Unpaid"}
                </span>
              </div>
              {receipt.payment_method && (
                <div className="flex justify-between text-stone-400 text-xs"><span>Method</span><span>{receipt.payment_method}</span></div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setReviewModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-stone-900 text-lg" style={{ fontFamily: "Lora, serif" }}>Rate your order</h3>
              <button onClick={() => { setReviewModal(null); setReviewItem(null); }} className="text-stone-400 hover:text-stone-600 text-xl leading-none">×</button>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-stone-600 mb-2">Item to review *</label>
              <select
                value={reviewItem?.id || ""}
                onChange={(e) => setReviewItem(reviewModal.order_items.find((item) => item.id === e.target.value) || null)}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-sm bg-stone-50"
              >
                {reviewModal.order_items.map((item) => {
                  const key = item.product_id ? `product:${item.product_id}` : item.service_id ? `service:${item.service_id}` : `order:${reviewModal.id}`;
                  return <option key={item.id} value={item.id} disabled={submitted.includes(key)}>{item.name}{submitted.includes(key) ? " — already reviewed" : ""}</option>;
                })}
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-stone-600 mb-2">Your rating *</label>
              <StarRating rating={rating} size="lg" interactive onChange={setRating} />
            </div>
            <div className="mb-4">
              <label className="block text-sm text-stone-600 mb-1">Write a review (optional)</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your experience with this shop or product…"
                rows={4}
                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 resize-none"
              />
            </div>
            <button
              onClick={handleReviewSubmit}
              disabled={!rating}
              className="w-full py-3 bg-[#1C3270] text-white rounded-xl font-semibold hover:bg-[#0F1F4A] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit Review
            </button>
          </div>
        </div>
      )}
    </div>
  );
}