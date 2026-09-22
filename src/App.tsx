import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";

import AnnouncementBanner from "./components/layout/AnnouncementBanner";
import Navbar from "./components/layout/Navbar";
import MobileNav from "./components/layout/MobileNav";
import Footer from "./components/layout/Footer";
import AuthModal from "./components/auth/AuthModal";
import ScrollToTop from "./components/layout/ScrollToTop";

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Each page is downloaded only when first visited, not on initial app load.
// This splits the bundle from one large file into small per-route chunks,
// dramatically improving Time to Interactive on first visit.
const HomePage            = lazy(() => import("./pages/HomePage"));
const BrowsePage          = lazy(() => import("./pages/BrowsePage"));
const ShopPage            = lazy(() => import("./pages/ShopPage"));
const ProductDetailPage   = lazy(() => import("./pages/ProductDetailPage"));
const ServiceDetailPage   = lazy(() => import("./pages/ServiceDetailPage"));
const CartPage            = lazy(() => import("./pages/CartPage"));
const MyOrdersPage        = lazy(() => import("./pages/MyOrdersPage"));
const AccountPage         = lazy(() => import("./pages/AccountPage"));
const WishlistPage        = lazy(() => import("./pages/WishlistPage"));
const BecomeSellerPage    = lazy(() => import("./pages/BecomeSellerPage"));
const SellerDashboard     = lazy(() => import("./pages/SellerDashboard"));
const AdminPanel          = lazy(() => import("./pages/AdminPanel"));
const NotificationsPage   = lazy(() => import("./pages/NotificationsPage"));
const PaymentCompletePage = lazy(() => import("./pages/PaymentCompletePage"));
const NotFoundPage        = lazy(() => import("./pages/NotFoundPage"));
const SupportPage         = lazy(() => import("./pages/SupportPage"));
const QuickSellPage       = lazy(() => import("./pages/QuickSellPage"));

// ─── Suspense fallback ────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <svg
        className="animate-spin w-8 h-8 text-[#1C3270]"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}

function DarkModeSync() {
  const { darkMode } = useApp();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);
  return null;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden bg-[#F4F7FB] dark:bg-[#0B1628] transition-colors duration-200">
      <AnnouncementBanner />
      <Navbar />
      {/* pb-20 clears the fixed mobile bottom nav (h-16 = 64px) on all pages */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>
      <Footer />
      <MobileNav />
      <AuthModal />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <DarkModeSync />
        <ScrollToTop />
        <Layout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/"                  element={<HomePage />} />
              <Route path="/browse"            element={<BrowsePage />} />
              <Route path="/shop/:slug"        element={<ShopPage />} />
              <Route path="/product/:slug"     element={<ProductDetailPage />} />
              <Route path="/service/:slug"     element={<ServiceDetailPage />} />
              <Route path="/cart"              element={<CartPage />} />
              <Route path="/orders"            element={<MyOrdersPage />} />
              <Route path="/account"           element={<AccountPage />} />
              <Route path="/wishlist"          element={<WishlistPage />} />
              <Route path="/become-seller"     element={<BecomeSellerPage />} />
              <Route path="/seller/dashboard"  element={<SellerDashboard />} />
              <Route path="/admin"             element={<AdminPanel />} />
              <Route path="/notifications"     element={<NotificationsPage />} />
              <Route path="/payment-complete"  element={<PaymentCompletePage />} />
              <Route path="/reset-password"    element={<HomePage />} />
              <Route path="/about"             element={<SupportPage />} />
              <Route path="/contact"           element={<SupportPage />} />
              <Route path="/terms"             element={<SupportPage />} />
              <Route path="/privacy"           element={<SupportPage />} />
              <Route path="/how-it-works"      element={<SupportPage />} />
              <Route path="/resources"         element={<SupportPage />} />
              <Route path="/quick-sell"        element={<QuickSellPage />} />
              <Route path="*"                  element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
