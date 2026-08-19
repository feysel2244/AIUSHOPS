import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext";
import { supabase } from "../../lib/supabase";
import { useCategories } from "../../hooks/useCategories";

export default function Navbar() {
  const { categories } = useCategories();
  const {
    user, setUser, cartCount,
    notifications, unreadCount, markRead, markAllRead,
    openAuthModal, darkMode, toggleDarkMode,
  } = useApp();
  const [search, setSearch] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<{ type: "shop" | "product" | "service"; label: string; sub: string; to: string }[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    const term = search.trim();
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      const pattern = `%${term}%`;
      const [{ data: shops }, { data: products }, { data: services }] = await Promise.all([
        supabase.from("shops").select("name,slug,category").eq("status", "approved").is("deleted_at", null).ilike("name", pattern).limit(3),
        supabase.from("products").select("name,slug,price,shops(name)").ilike("name", pattern).limit(3),
        supabase.from("services").select("name,slug,price,shops(name)").ilike("name", pattern).limit(2),
      ]);

      if (!active) return;
      setSuggestions([
        ...(shops ?? []).map((s: any) => ({ type: "shop" as const, label: s.name, sub: s.category, to: `/shop/${s.slug}` })),
        ...(products ?? []).map((p: any) => ({ type: "product" as const, label: p.name, sub: `RM ${Number(p.price).toFixed(2)} - ${p.shops?.name || "AIU Shop"}`, to: `/product/${p.slug}` })),
        ...(services ?? []).map((s: any) => ({ type: "service" as const, label: s.name, sub: `RM ${Number(s.price).toFixed(2)} - ${s.shops?.name || "AIU Shop"}`, to: `/service/${s.slug}` })),
      ]);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [search]);
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (search.trim()) navigate(`/browse?q=${encodeURIComponent(search)}`);
    setSearch("");
  }

  function handleLogout() {
    setUser(null);
    setProfileOpen(false);
  }

  const previewNotifs = notifications.slice(0, 4);

  return (
    <nav className="bg-white dark:bg-[#0D1E36] border-b border-stone-200 dark:border-[#1C3058] sticky top-0 z-40 shadow-sm dark:shadow-[0_1px_0_#1C3058]">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          {/* 3-color logo mark matching the university brand */}
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
            <rect width="32" height="32" rx="7" fill="#1C3270" />
            <rect x="6" y="6" width="8" height="8" rx="1.5" fill="white" />
            <rect x="18" y="6" width="8" height="8" rx="1.5" fill="#44B444" />
            <rect x="6" y="18" width="8" height="8" rx="1.5" fill="#44B444" />
            <rect x="18" y="18" width="8" height="8" rx="1.5" fill="#00B4C6" />
          </svg>
          <div className="hidden sm:block">
            <div className="font-bold text-[#1C3270] dark:text-[#5B8FD4] text-sm leading-tight" style={{ fontFamily: "Lora, serif" }}>
              AIU Market
            </div>
            <div className="text-[10px] text-stone-400 dark:text-[#4E6A88] leading-tight tracking-wide">Campus Marketplace</div>
          </div>
        </Link>

        {/* Search bar — hidden on mobile (bottom nav has Search tab) */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl">
          <div className="relative flex flex-1" ref={searchRef}>
            {/* Category picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => { setCatOpen(!catOpen); setProfileOpen(false); setNotifOpen(false); setSuggestOpen(false); }}
                className="h-10 px-3 bg-stone-50 dark:bg-[#0E1A2E] border border-stone-200 dark:border-[#1C3058] border-r-0 rounded-l-lg text-xs text-stone-600 dark:text-[#8BACC8] flex items-center gap-1 hover:bg-stone-100 dark:hover:bg-[#162030] transition-colors whitespace-nowrap select-none"
              >
                All <span className="text-stone-400 text-[10px]">▾</span>
              </button>
              {catOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl z-50 w-48 py-1 overflow-hidden">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        navigate(`/browse?cat=${encodeURIComponent(c.name)}`);
                        setCatOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 hover:text-[#1C3270] transition-colors"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSuggestOpen(true); setCatOpen(false); }}
              onFocus={() => { if (search.trim().length >= 2) setSuggestOpen(true); }}
              placeholder="Search shops, products, services..."
              className="flex-1 h-10 px-3 border border-stone-200 dark:border-[#1C3058] text-sm focus:outline-none focus:border-[#1C3270] bg-stone-50 dark:bg-[#0E1A2E] dark:text-[#E2EAF6] dark:placeholder:text-[#4E6A88] min-w-0"
              autoComplete="off"
            />

            {/* Autocomplete dropdown */}
            {suggestOpen && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#112038] border border-stone-200 dark:border-[#1C3058] rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => {
                      navigate(s.to);
                      setSearch("");
                      setSuggestOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-stone-50 transition-colors"
                  >
                    <span className="text-base flex-shrink-0">
                      {s.type === "shop" ? "🏪" : s.type === "product" ? "📦" : "🗓️"}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-stone-900 truncate">{s.label}</div>
                      <div className="text-xs text-stone-400 truncate">{s.sub}</div>
                    </div>
                    <span className="ml-auto text-[10px] text-stone-300 uppercase tracking-wide flex-shrink-0">{s.type}</span>
                  </button>
                ))}
                <div className="border-t border-stone-100 mt-1 pt-1">
                  <button
                    type="submit"
                    className="w-full text-left px-4 py-2 text-xs text-[#1C3270] font-medium hover:bg-stone-50 transition-colors"
                  >
                    Search all results for &ldquo;{search}&rdquo; →
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              onClick={() => setSuggestOpen(false)}
              className="h-10 px-4 bg-[#1C3270] text-white rounded-r-lg hover:bg-[#0F1F4A] transition-colors text-sm flex-shrink-0"
              aria-label="Search"
            >
              🔍
            </button>
          </div>
        </form>

        {/* Mobile: spacer so logo stays left and icons stay right */}
        <div className="flex-1 md:hidden" />

        {/* Right actions */}
        <div className="flex items-center gap-1">
          <Link
            to="/browse"
            className="hidden md:block text-sm text-stone-600 hover:text-[#1C3270] transition-colors px-2 py-1.5 rounded-lg hover:bg-stone-50 whitespace-nowrap"
          >
            Browse
          </Link>

          {/* Cart — hidden on mobile (bottom nav handles it) */}
          <Link
            to="/cart"
            className="hidden md:flex relative p-2 text-stone-600 hover:text-[#1C3270] transition-colors rounded-lg hover:bg-stone-50"
            aria-label={`Cart — ${cartCount} item${cartCount !== 1 ? "s" : ""}`}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#1C3270] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {/* Notifications bell */}
          {user && (
            <div className="relative">
              <button
                onClick={() => { setNotifOpen(!notifOpen); setProfileOpen(false); setCatOpen(false); }}
                className="relative p-2 text-stone-600 hover:text-[#1C3270] transition-colors rounded-lg hover:bg-stone-50"
                aria-label={`Notifications — ${unreadCount} unread`}
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-[#44B444] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="fixed left-3 right-3 top-16 w-auto max-w-none max-h-[calc(100vh-5rem)] bg-white dark:bg-[#112038] border border-stone-200 dark:border-[#1C3058] rounded-2xl shadow-2xl z-50 overflow-hidden sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-h-none">
                  <div className="px-4 py-3 border-b border-stone-100 dark:border-[#1C3058] flex items-center justify-between">
                    <span className="font-bold text-sm text-stone-900" style={{ fontFamily: "Lora, serif" }}>
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 text-xs font-normal text-stone-400">({unreadCount} new)</span>
                      )}
                    </span>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-[#1C3270] hover:text-[#0F1F4A] font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                      <button onClick={() => setNotifOpen(false)} className="text-stone-400 hover:text-stone-600 text-lg leading-none">✕</button>
                    </div>
                  </div>

                  <div className="divide-y divide-stone-50 max-h-[calc(100vh-10rem)] overflow-y-auto sm:max-h-80">
                    {previewNotifs.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-stone-400">No notifications yet</div>
                    ) : (
                      previewNotifs.map((n) => (
                        <Link
                          key={n.id}
                          to={n.linkTo ?? "/notifications"}
                          onClick={() => { markRead(n.id); setNotifOpen(false); }}
                          className={`flex items-start gap-3 px-4 py-3 hover:bg-stone-50 transition-colors ${n.unread ? "bg-blue-50/60" : ""}`}
                        >
                          <span className="text-lg flex-shrink-0 mt-0.5">{n.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-stone-800 break-words whitespace-normal">{n.title}</p>
                            <p className="text-xs text-stone-500 mt-0.5 break-words whitespace-normal">{n.body}</p>
                            <p className="text-[10px] text-stone-400 mt-1">{n.time}</p>
                          </div>
                          {n.unread && (
                            <div className="w-2 h-2 rounded-full bg-[#44B444] flex-shrink-0 mt-1.5" />
                          )}
                        </Link>
                      ))
                    )}
                  </div>

                  <div className="px-4 py-2 border-t border-stone-100">
                    <Link
                      to="/notifications"
                      onClick={() => setNotifOpen(false)}
                      className="block text-center text-xs text-[#1C3270] hover:text-[#0F1F4A] font-semibold py-1 transition-colors"
                    >
                      View all notifications →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg text-stone-500 dark:text-[#6888A8] hover:bg-stone-100 dark:hover:bg-[#162030] transition-colors"
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
          >
            {darkMode ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
              </svg>
            )}
          </button>

          {/* Profile menu */}
          {user ? (
            <div className="relative">
              <button
                onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); setCatOpen(false); }}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-stone-50 transition-colors ml-1"
              >
                <div className="w-8 h-8 rounded-full bg-[#1C3270] text-white flex items-center justify-center text-sm font-bold leading-none">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <span className="hidden md:block text-sm text-stone-700 max-w-[90px] truncate">
                  {user.name.split(" ")[0]}
                </span>
                <svg className="hidden md:block w-3 h-3 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#112038] border border-stone-200 dark:border-[#1C3058] rounded-2xl shadow-xl z-50 py-1 overflow-hidden">
                  <div className="px-4 py-3 border-b border-stone-100 dark:border-[#1C3058]">
                    <div className="font-semibold text-sm text-stone-900 truncate">{user.name}</div>
                    <div className="text-xs text-stone-400 truncate mt-0.5">{user.email}</div>
                    <div className="text-xs text-stone-400 mt-0.5">{user.department} · {user.year}</div>
                  </div>

                  <div className="py-1">
                    {user.hasShop ? (
                      <Link
                        to="/seller/dashboard"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                      >
                        <span>🏪</span> <span>Seller Dashboard</span>
                      </Link>
                    ) : (
                      <Link
                        to="/become-seller"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold hover:bg-blue-50 transition-colors"
                        style={{ color: "#1C3270" }}
                      >
                        <span>✨</span> <span>Become a Seller</span>
                      </Link>
                    )}

                    {user.isAdmin && (
                      <Link
                        to="/admin"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50"
                      >
                        <span>⚙️</span> <span>Admin Panel</span>
                      </Link>
                    )}

                    <Link to="/orders" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50">
                      <span>📦</span> <span>My Orders</span>
                    </Link>
                    <Link to="/wishlist" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50">
                      <span>❤️</span> <span>Wishlist</span>
                    </Link>
                    <Link to="/notifications" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50">
                      <span>🔔</span>
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="ml-auto min-w-[18px] h-[18px] bg-[#44B444] text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                          {unreadCount}
                        </span>
                      )}
                    </Link>
                    <Link to="/account" onClick={() => setProfileOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-stone-700 hover:bg-stone-50">
                      <span>👤</span> <span>Account Settings</span>
                    </Link>
                  </div>

                  <div className="border-t border-stone-100 py-1">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <span>🚪</span> <span>Log out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 ml-1">
              <button
                onClick={() => openAuthModal("login")}
                className="text-sm text-stone-600 hover:text-[#1C3270] font-medium px-3 py-1.5 rounded-lg hover:bg-stone-50 transition-colors"
              >
                Log in
              </button>
              <button
                onClick={() => openAuthModal("signup")}
                className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors text-white"
                style={{ background: "#1C3270" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#0F1F4A")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#1C3270")}
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Click-outside overlay */}
      {(catOpen || notifOpen || profileOpen) && (
        <div
          className="fixed inset-0 z-[28]"
          onClick={() => { setCatOpen(false); setNotifOpen(false); setProfileOpen(false); }}
        />
      )}
    </nav>
  );
}
