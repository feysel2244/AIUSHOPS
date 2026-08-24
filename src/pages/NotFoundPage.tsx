import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-24 text-center">
      <div className="text-7xl mb-6" style={{ fontFamily: "Lora, serif", color: "#1C3270" }}>404</div>
      <h2 className="text-2xl font-bold text-stone-900 mb-2" style={{ fontFamily: "Lora, serif" }}>Page not found</h2>
      <p className="text-stone-500 mb-6">This shop, product, or page doesn't exist — the link may have changed or the listing may have been removed.</p>
      <div className="flex items-center justify-center gap-3">
        <Link to="/" className="px-6 py-2.5 bg-[#1C3270] text-white rounded-xl font-semibold text-sm hover:bg-[#0F1F4A] transition-colors">
          Go Home
        </Link>
        <Link to="/browse" className="px-6 py-2.5 border border-stone-200 text-stone-700 rounded-xl font-semibold text-sm hover:bg-stone-50 transition-colors">
          Browse Shops
        </Link>
      </div>
    </div>
  );
}
