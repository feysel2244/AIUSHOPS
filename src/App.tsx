import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppProvider, useApp } from "./context/AppContext";

import AnnouncementBanner from "./components/layout/AnnouncementBanner";
import Navbar from "./components/layout/Navbar";
import MobileNav from "./components/layout/MobileNav";
import Footer from "./components/layout/Footer";
import AuthModal from "./components/auth/AuthModal";
import ScrollToTop from "./components/layout/ScrollToTop";

import HomePage from "./pages/HomePage";
import BrowsePage from "./pages/BrowsePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import CartPage from "./pages/CartPage";
import MyOrdersPage from "./pages/MyOrdersPage";
import AccountPage from "./pages/AccountPage";
import WishlistPage from "./pages/WishlistPage";
import BecomeSellerPage from "./pages/BecomeSellerPage";
import SellerDashboard from "./pages/SellerDashboard";
import AdminPanel from "./pages/AdminPanel";
import NotificationsPage from "./pages/NotificationsPage";
import PaymentCompletePage from "./pages/PaymentCompletePage";
import NotFoundPage from "./pages/NotFoundPage";
import SupportPage from "./pages/SupportPage";

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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/browse" element={<BrowsePage />} />
            <Route path="/shop/:slug" element={<ShopPage />} />
            <Route path="/product/:slug" element={<ProductDetailPage />} />
            <Route path="/service/:slug" element={<ServiceDetailPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/orders" element={<MyOrdersPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/wishlist" element={<WishlistPage />} />
            <Route path="/become-seller" element={<BecomeSellerPage />} />
            <Route path="/seller/dashboard" element={<SellerDashboard />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/payment-complete" element={<PaymentCompletePage />} />
            <Route path="/reset-password" element={<HomePage />} />
            <Route path="/about" element={<SupportPage />} />
            <Route path="/contact" element={<SupportPage />} />
            <Route path="/terms" element={<SupportPage />} />
            <Route path="/privacy" element={<SupportPage />} />
            <Route path="/how-it-works" element={<SupportPage />} />
            <Route path="/resources" element={<SupportPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppProvider>
  );
}
