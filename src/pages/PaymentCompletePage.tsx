import { Link } from "react-router-dom";

/**
 * The old Billplz redirect callback page. No longer used —
 * the P2P QR payment flow is now handled inline in CartPage and MyOrdersPage.
 */
export default function PaymentCompletePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16">
      <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-8 text-center">
        <div className="text-4xl mb-4">📦</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>
          Looking for your orders?
        </h1>
        <p className="text-sm text-stone-500 mb-6">
          Payments are now handled directly in the app. Check your orders below to see their status.
        </p>
        <Link
          to="/orders"
          className="block w-full py-3 bg-[#1C3270] text-white rounded-xl text-sm font-bold hover:bg-[#0F1F4A] transition-colors"
        >
          View My Orders
        </Link>
      </div>
    </div>
  );
}
